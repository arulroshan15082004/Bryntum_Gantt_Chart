import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskFormComponent } from '../task-form/task-form.component';
import { TaskStore, Task, Dependency, Resource } from '../../core/state/task-store.service';
import { TaskApiService } from '../../core/services/task-api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BryntumGanttModule, BryntumGanttComponent } from '@bryntum/gantt-angular';
import { checkDependencyConflict, calculateSuccessorDates, addDays } from '../../core/utils/scheduler.utils';

@Component({
  selector: 'app-gantt-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    NzModalModule,
    PageHeaderComponent,
    TaskFormComponent,
    BryntumGanttModule
  ],
  templateUrl: './gantt-view.component.html',
  styleUrl: './gantt-view.component.scss'
})
export class GanttViewComponent implements OnInit, OnDestroy, AfterViewInit {
  public selectedProjectId: string | null = null;
  public flatTasks: Task[] = [];
  public taskTree: any[] = [];
  public dependencies: any[] = [];
  public resources: any[] = [];
  public isLocalChange = false;
  private pendingTaskUpdates = new Map<string, any>();
  private saveTimeout: any = null;

  // Project Date Bounds
  public projectStartDate: Date | string = '2026-05-01';
  public projectEndDate: Date | string = '2026-06-30';

  // Bryntum Column configurations
  public ganttColumns = [
    { type: 'name', text: 'Task Name', width: 250 },
    { type: 'startdate', text: 'Start Date', width: 120, format: 'DD/MM/YYYY' },
    { type: 'enddate', text: 'End Date', width: 120, format: 'DD/MM/YYYY' },
    { type: 'duration', text: 'Duration', width: 80 },
    { type: 'percentdone', text: 'Progress', width: 80 },
    { type: 'resourceassignment', text: 'Resources', width: 150 }
  ];

  // Drawer Controls & Dialogs
  public isDrawerVisible = false;
  public editingTask: Task | null = null;
  
  public isDepModalVisible = false;
  public depSubmitting = false;
  public depFromTaskId: string | null = null;
  public depToTaskId: string | null = null;
  public depType: 'FS' | 'SS' | 'FF' | 'SF' = 'FS';
  public depLag = 0;

  @ViewChild('gantt') private ganttComponent!: BryntumGanttComponent;

  private destroy$ = new Subject<void>();

  constructor(
    private store: TaskStore,
    private taskApi: TaskApiService,
    private message: NzMessageService,
    private modal: NzModalService
  ) {}

  ngOnInit(): void {
    // 1. Listen to selected project
    this.store.selectedProjectId$.pipe(takeUntil(this.destroy$)).subscribe(id => {
      this.selectedProjectId = id;
    });

    // 2. Watch task list to build hierarchy and calculate scale bounds
    this.store.tasks$.pipe(takeUntil(this.destroy$)).subscribe(tasks => {
      this.flatTasks = tasks.map(t => ({ ...t, id: t.id || t._id }));
    });

    this.store.taskTree$.pipe(takeUntil(this.destroy$)).subscribe(tree => {
      if (this.isLocalChange) {
        console.log('Skipping taskTree re-binding for Gantt due to local change');
        this.isLocalChange = false; // Reset the flag
        return;
      }
      console.log('Reloading taskTree for Gantt from store update');
      this.taskTree = this.mapTasksForBryntum(tree);
      this.calculateProjectDateBounds(this.taskTree);
    });

    // 3. Watch dependencies
    this.store.dependencies$.pipe(takeUntil(this.destroy$)).subscribe(deps => {
      this.dependencies = this.mapDependenciesForBryntum(deps);
    });

    // 4. Watch resources
    this.store.resources$.pipe(takeUntil(this.destroy$)).subscribe(res => {
      this.resources = res.map(r => ({ ...r, id: r.id || r._id }));
    });
  }

  private mapTasksForBryntum(tasks: any[]): any[] {
    const formatDateOnly = (dateVal: any): string => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return tasks.map(task => {
      const mapped = {
        ...task,
        id: task.id || task._id,
        startDate: formatDateOnly(task.startDate),
        endDate: formatDateOnly(task.endDate),
        percentDone: task.progress !== undefined ? Number(task.progress) : 0,
        manuallyScheduled: true // Disable automatic date shifting unless dependency logic needs it
      };
      if (task.children && task.children.length > 0) {
        mapped.children = this.mapTasksForBryntum(task.children);
      }
      return mapped;
    });
  }

  private mapDependenciesForBryntum(deps: any[]): any[] {
    const typeMap: { [key: string]: number } = {
      'SS': 0,
      'SF': 1,
      'FS': 2,
      'FF': 3
    };

    return deps.map(dep => ({
      ...dep,
      id: dep.id || dep._id,
      from: dep.from || dep.fromTaskId,
      to: dep.to || dep.toTaskId,
      type: typeof dep.type === 'string' ? (typeMap[dep.type] ?? 2) : dep.type
    }));
  }

  ngOnDestroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private calculateProjectDateBounds(tasks: Task[]): void {
    if (tasks.length === 0) {
      this.projectStartDate = '2026-05-01';
      this.projectEndDate = '2026-06-30';
      return;
    }

    let minDate = new Date();
    let maxDate = new Date(Date.now() + 30 * 86400000);

    const checkDates = (t: Task) => {
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
      if (t.children) t.children.forEach(checkDates);
    };

    tasks.forEach(checkDates);

    // Padding bounds slightly for visual margin
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);

    this.projectStartDate = minDate;
    this.projectEndDate = maxDate;
  }

  ngAfterViewInit(): void {
    this.registerGanttListenersWithRetry();
  }

  private registerGanttListenersWithRetry(attempts = 0): void {
    const gantt = this.ganttComponent?.instance;
    const project = gantt?.project;
    if (project) {
      console.log('Successfully bound Bryntum Gantt listeners!');
      
      // Programmatically disable the awkward orange vertical project lines
      if (gantt.features && gantt.features.projectLines) {
        gantt.features.projectLines.disabled = true;
      }
      
      this.setupStoreListeners();
    } else if (attempts < 20) {
      setTimeout(() => {
        this.registerGanttListenersWithRetry(attempts + 1);
      }, 200);
    } else {
      console.error('Failed to bind Bryntum Gantt listeners: Project instance not found.');
    }
  }

  private setupStoreListeners(): void {
    const project = (this.ganttComponent?.instance as any)?.project;
    if (project) {
      project.taskStore.on('update', (event: any) => this.handleTaskStoreUpdate(event));
      project.dependencyStore.on('add', (event: any) => this.handleDependencyStoreAdd(event));
      project.dependencyStore.on('remove', (event: any) => this.handleDependencyStoreRemove(event));
    }
  }

  public handleTaskStoreUpdate(event: any): void {
    const { record } = event;
    if (!record) return;

    const taskId = record.id || record._id;
    if (!taskId || String(taskId).startsWith('_')) return; // ignore client-side temp nodes

    // Format Date using local components to prevent day shifts
    const formatDateOnly = (dateVal: any): string => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Extract the full set of fields to save
    const updatedFields: any = {
      id: taskId,
      name: record.name,
      startDate: record.startDate ? formatDateOnly(record.startDate) : undefined,
      endDate: record.endDate ? formatDateOnly(record.endDate) : undefined,
      duration: record.duration !== undefined ? Number(record.duration) : undefined,
      progress: record.percentDone !== undefined ? Number(record.percentDone) : undefined,
      status: record.status,
      priority: record.priority,
      isMilestone: record.isMilestone,
      resourceIds: record.resourceIds || []
    };

    // Clean undefined keys
    Object.keys(updatedFields).forEach(key => updatedFields[key] === undefined && delete updatedFields[key]);

    this.pendingTaskUpdates.set(taskId, updatedFields);

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.savePendingGanttUpdates();
    }, 400);
  }

  private savePendingGanttUpdates(): void {
    if (this.pendingTaskUpdates.size === 0) return;

    const tasksToSave = Array.from(this.pendingTaskUpdates.values());
    this.pendingTaskUpdates.clear();

    const project = (this.ganttComponent?.instance as any)?.project;

    console.log(`Debounced Gantt Save! Checking dependency conflicts for ${tasksToSave.length} modified tasks...`, tasksToSave);

    const checkConflictsAndPrompt = (index: number) => {
      if (index >= tasksToSave.length) {
        this.executeBulkSave(tasksToSave, project);
        return;
      }

      const taskAUpdate = tasksToSave[index];
      const taskAId = String(taskAUpdate.id || taskAUpdate._id);
      const originalTaskA = this.flatTasks.find(t => String(t._id || t.id) === taskAId);
      if (!originalTaskA) {
        checkConflictsAndPrompt(index + 1);
        return;
      }

      const taskA = { ...originalTaskA, ...taskAUpdate };
      const deps = this.store.getSnapshot().dependencies;

      // 1. Check predecessor conflicts (where taskA is the successor)
      const predecessors = deps.filter(d => String(d.toTaskId) === taskAId);
      let foundPredConflict = false;
      let predTask: any = null;
      let predDep: any = null;

      for (const dep of predecessors) {
        const predId = String(dep.fromTaskId);
        const originalPred = this.flatTasks.find(t => String(t._id || t.id) === predId);
        if (originalPred) {
          const existingInSave = tasksToSave.find(t => String(t.id || t._id) === predId);
          const pred = existingInSave ? { ...originalPred, ...existingInSave } : originalPred;
          const hasConflict = checkDependencyConflict(pred, taskA, dep.type, dep.lag);
          if (hasConflict) {
            foundPredConflict = true;
            predTask = pred;
            predDep = dep;
            break;
          }
        }
      }

      if (foundPredConflict && predTask && predDep) {
        this.modal.confirm({
          nzTitle: 'Dependency Constraint Violation',
          nzContent: `Task "${taskA.name}" violates dependency constraint with predecessor "${predTask.name}". Do you want to auto-adjust "${taskA.name}" to satisfy the dependency?`,
          nzOkText: 'Yes',
          nzCancelText: 'No',
          nzOnOk: () => {
            const newDates = calculateSuccessorDates(predTask, taskA.duration, predDep.type, predDep.lag);
            taskAUpdate.startDate = newDates.startDate;
            taskAUpdate.endDate = newDates.endDate;
            
            // Re-check this task index (with updated dates)
            checkConflictsAndPrompt(index);
          },
          nzOnCancel: () => {
            this.message.warning(`Dependency Conflict Warning: Task "${taskA.name}" violates predecessor constraint.`);
            // Continue past predecessor check to successor check
            checkSuccessorsOnly(index);
          }
        });
        return;
      }

      checkSuccessorsOnly(index);
    };

    const checkSuccessorsOnly = (index: number) => {
      const taskAUpdate = tasksToSave[index];
      const taskAId = String(taskAUpdate.id || taskAUpdate._id);
      const originalTaskA = this.flatTasks.find(t => String(t._id || t.id) === taskAId);
      if (!originalTaskA) {
        checkConflictsAndPrompt(index + 1);
        return;
      }

      const taskA = { ...originalTaskA, ...taskAUpdate };
      const deps = this.store.getSnapshot().dependencies;

      // 2. Check successor conflicts (where taskA is the predecessor)
      const successors = deps.filter(d => String(d.fromTaskId) === taskAId);
      let foundSuccConflict = false;
      let successorTask: any = null;
      let conflictingDep: any = null;

      for (const dep of successors) {
        const succId = String(dep.toTaskId);
        const originalSucc = this.flatTasks.find(t => String(t._id || t.id) === succId);
        if (originalSucc) {
          const existingInSave = tasksToSave.find(t => String(t.id || t._id) === succId);
          const succ = existingInSave ? { ...originalSucc, ...existingInSave } : originalSucc;
          const hasConflict = checkDependencyConflict(taskA, succ, dep.type, dep.lag);
          if (hasConflict) {
            foundSuccConflict = true;
            successorTask = succ;
            conflictingDep = dep;
            break;
          }
        }
      }

      if (foundSuccConflict && successorTask && conflictingDep) {
        this.modal.confirm({
          nzTitle: 'Dependency Conflict Warning',
          nzContent: `Task "${successorTask.name}" depends on Task "${taskA.name || 'Predecessor'}". Do you want to auto-adjust dependent tasks?`,
          nzOkText: 'Yes',
          nzCancelText: 'No',
          nzOnOk: () => {
            const adjustSuccessor = (parentTask: any, childTask: any, depObj: any) => {
              const newDates = calculateSuccessorDates(parentTask, childTask.duration, depObj.type, depObj.lag);
              const childUpdate = {
                id: childTask._id || childTask.id,
                startDate: newDates.startDate,
                endDate: newDates.endDate,
                duration: childTask.duration
              };

              const existingIndex = tasksToSave.findIndex(t => String(t.id || t._id) === String(childTask._id || childTask.id));
              if (existingIndex !== -1) {
                tasksToSave[existingIndex] = { ...tasksToSave[existingIndex], ...childUpdate };
              } else {
                tasksToSave.push(childUpdate);
              }

              const childSuccessors = deps.filter(d => String(d.fromTaskId) === String(childTask._id || childTask.id));
              for (const cd of childSuccessors) {
                const nextChildId = String(cd.toTaskId);
                const nextChild = this.flatTasks.find(t => String(t._id || t.id) === nextChildId);
                if (nextChild) {
                  const existingNextInSave = tasksToSave.find(t => String(t.id || t._id) === nextChildId);
                  const mergedNextChild = existingNextInSave ? { ...nextChild, ...existingNextInSave } : nextChild;
                  adjustSuccessor(childUpdate, mergedNextChild, cd);
                }
              }
            };

            adjustSuccessor(taskA, successorTask, conflictingDep);
            // Re-check this index to see if cascading changes caused other conflicts
            checkConflictsAndPrompt(index);
          },
          nzOnCancel: () => {
            this.message.warning(`Dependency Conflict Warning: Task "${successorTask.name}" depends on Task "${taskA.name || 'Predecessor'}" and is in conflict.`);
            checkConflictsAndPrompt(index + 1);
          }
        });
      } else {
        checkConflictsAndPrompt(index + 1);
      }
    };

    checkConflictsAndPrompt(0);
  }

  private executeBulkSave(tasksToSave: any[], project: any): void {
    this.isLocalChange = true;

    this.taskApi.bulkUpdateTasks(tasksToSave).subscribe({
      next: () => {
        this.message.success(`Successfully saved ${tasksToSave.length} task updates to MongoDB.`);
        
        // Update local store in bulk
        this.store.localUpdateTasks(tasksToSave);

        // Clear Bryntum's dirty/change-tracking flag
        if (project) {
          project.acceptChanges();
        }

        // Re-fetch all tasks of the project to clear cache and sync Gantt/Table perfectly
        const pid = this.selectedProjectId;
        if (pid) {
          this.taskApi.getTasks(pid).subscribe({
            next: (taskList) => {
              this.store.setTasks(taskList);
            },
            error: (err) => {
              console.error('Error refreshing tasks after Gantt update:', err);
            }
          });
        }

        this.refreshPaginatedTasks();
      },
      error: (err: any) => {
        this.isLocalChange = false;
        this.message.error(err.error?.message || err.message || 'Error bulk saving tasks');
      }
    });
  }

  private createDependencyWithCascading(dependencyObj: any, onFail?: () => void): void {
    const from = dependencyObj.fromTaskId;
    const to = dependencyObj.toTaskId;
    const type = dependencyObj.type;
    const lag = Number(dependencyObj.lag) || 0;

    const taskA = this.flatTasks.find(t => String(t._id || t.id) === String(from));
    const taskB = this.flatTasks.find(t => String(t._id || t.id) === String(to));

    if (!taskA || !taskB) {
      this.message.error('One or both tasks were not found.');
      this.depSubmitting = false;
      if (onFail) onFail();
      return;
    }

    // --- Validation Rules ---
    // 1. Self Dependency
    if (from === to) {
      this.message.error('A task cannot depend on itself.');
      this.depSubmitting = false;
      if (onFail) onFail();
      return;
    }

    // 2. Decimal Lag
    if (!Number.isInteger(Number(lag))) {
      this.message.error('Lag must be a whole number.');
      this.depSubmitting = false;
      if (onFail) onFail();
      return;
    }

    // Get snapshot of current dependencies
    const currentDeps = this.store.getSnapshot().dependencies;

    // 4. Duplicate Dependency check
    const duplicate = currentDeps.find(d => 
      String(d.fromTaskId) === String(from) && 
      String(d.toTaskId) === String(to)
    );
    if (duplicate) {
      this.message.error('Dependency already exists between these tasks.');
      this.depSubmitting = false;
      if (onFail) onFail();
      return;
    }

    // 5. Circular Dependency check
    const hasCircularPath = (startId: string, targetId: string): boolean => {
      const directDeps = currentDeps.filter(d => 
        String(d.fromTaskId) === String(startId)
      );
      for (const dep of directDeps) {
        const nextId = String(dep.toTaskId);
        if (nextId === targetId) return true;
        if (hasCircularPath(nextId, targetId)) return true;
      }
      return false;
    };

    if (hasCircularPath(to, from)) {
      this.message.error('Circular dependency detected.');
      this.depSubmitting = false;
      if (onFail) onFail();
      return;
    }

    // Recalculate successor dates immediately and cascade downstream
    const tasksToSave: any[] = [];
    
    const adjustSuccessor = (parentTask: any, childTask: any, depType: 'FS' | 'SS' | 'FF' | 'SF', depLag: number) => {
      const newDates = calculateSuccessorDates(parentTask, childTask.duration, depType, depLag);
      
      console.log('Predecessor dates:', { startDate: parentTask.startDate, endDate: parentTask.endDate });
      console.log('Lag days:', depLag);
      console.log('Calculated successor dates:', { startDate: newDates.startDate, endDate: newDates.endDate });

      const childUpdate = {
        id: childTask._id || childTask.id,
        startDate: newDates.startDate,
        endDate: newDates.endDate,
        duration: childTask.duration
      };

      const existingIndex = tasksToSave.findIndex(t => String(t.id || t._id) === String(childTask._id || childTask.id));
      if (existingIndex !== -1) {
        tasksToSave[existingIndex] = { ...tasksToSave[existingIndex], ...childUpdate };
      } else {
        tasksToSave.push(childUpdate);
      }

      const childSuccessors = currentDeps.filter(d => 
        String(d.fromTaskId) === String(childTask._id || childTask.id)
      );
      for (const cd of childSuccessors) {
        const nextChildId = String(cd.toTaskId);
        const nextChild = this.flatTasks.find(t => String(t._id || t.id) === nextChildId);
        if (nextChild) {
          const existingNextInSave = tasksToSave.find(t => String(t.id || t._id) === nextChildId);
          const mergedNextChild = existingNextInSave ? { ...nextChild, ...existingNextInSave } : nextChild;
          adjustSuccessor(childUpdate, mergedNextChild, cd.type, cd.lag);
        }
      }
    };

    adjustSuccessor(taskA, taskB, type, lag);

    console.log('Updated DB values (tasks to update):', tasksToSave);

    const performSaveDependency = () => {
      const executeSave = () => {
        this.taskApi.createDependency(dependencyObj).subscribe({
          next: (newDep) => {
            this.message.success('Dependency created successfully.');
            this.store.localAddDependency(newDep);
            this.depSubmitting = false;
            this.isDepModalVisible = false;
            
            // Reload tasks to sync
            if (this.selectedProjectId) {
              this.taskApi.getTasks(this.selectedProjectId).subscribe(taskList => {
                this.store.setTasks(taskList);
              });
            }
          },
          error: (err) => {
            this.message.error(err.error?.message || err.message || 'Failed to create dependency');
            this.depSubmitting = false;
            if (onFail) onFail();
          }
        });
      };

      if (tasksToSave.length > 0) {
        this.taskApi.bulkUpdateTasks(tasksToSave).subscribe({
          next: () => {
            this.store.localUpdateTasks(tasksToSave);
            executeSave();
          },
          error: (err) => {
            this.message.error(err.error?.message || err.message || 'Failed to auto-adjust dependent tasks.');
            this.depSubmitting = false;
            if (onFail) onFail();
          }
        });
      } else {
        executeSave();
      }
    };

    performSaveDependency();
  }

  public handleDependencyStoreAdd(event: any): void {
    const { records } = event;
    if (!records || records.length === 0) return;

    records.forEach((depRecord: any) => {
      const from = depRecord.from || depRecord.fromEvent?.id;
      const to = depRecord.to || depRecord.toEvent?.id;
      const project = this.selectedProjectId;

      if (!from || !to || !project || from === to) return;

      const typeMapInv: { [key: number]: string } = {
        0: 'SS',
        1: 'SF',
        2: 'FS',
        3: 'FF'
      };

      const dependencyObj = {
        projectId: project,
        fromTaskId: from,
        toTaskId: to,
        type: (typeMapInv[depRecord.type] || 'FS') as any,
        lag: depRecord.lag || 0
      };

      const onFail = () => {
        const dependencyStore = (this.ganttComponent?.instance as any)?.project?.dependencyStore;
        if (dependencyStore) {
          dependencyStore.remove(depRecord);
        }
      };

      this.createDependencyWithCascading(dependencyObj, onFail);
    });
  }

  public handleDependencyStoreRemove(event: any): void {
    const { records } = event;
    if (!records || records.length === 0) return;

    records.forEach((depRecord: any) => {
      const dbId = depRecord.id || depRecord._id;
      if (!dbId || String(dbId).startsWith('_')) return; // ignore temporary local IDs

      this.taskApi.deleteDependency(dbId).subscribe({
        next: () => {
          this.message.success('Dependency removed.');
          this.store.localDeleteDependency(dbId);
        },
        error: (err) => {
          this.message.error(err.error?.message || err.message || 'Failed to remove dependency');
        }
      });
    });
  }

  private refreshPaginatedTasks(): void {
    const pid = this.selectedProjectId;
    if (pid) {
      const pag = this.store.getSnapshot().pagination;
      this.taskApi.getPaginatedTasks(pid, pag.page, pag.limit).subscribe(res => {
        this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
      });
    }
  }

  // Task form drawer triggers
  public openCreateDrawer(): void {
    this.editingTask = null;
    this.isDrawerVisible = true;
  }

  public closeDrawer(): void {
    this.isDrawerVisible = false;
    this.editingTask = null;
  }

  public onTaskSaved(): void {
    this.closeDrawer();
    // Refresh task list
    if (this.selectedProjectId) {
      this.taskApi.getTasks(this.selectedProjectId).subscribe(taskList => {
        this.store.setTasks(taskList);
      });
    }
  }

  // Predecessor dependency modal dialogs
  public openDependencyModal(): void {
    this.depFromTaskId = null;
    this.depToTaskId = null;
    this.depType = 'FS';
    this.depLag = 0;
    this.isDepModalVisible = true;
  }

  public closeDependencyModal(): void {
    this.isDepModalVisible = false;
  }

  public submitDependency(): void {
    const from = this.depFromTaskId;
    const to = this.depToTaskId;
    const project = this.selectedProjectId;

    if (!from || !to || !project) {
      this.message.warning('Please select both predecessor and successor tasks.');
      return;
    }

    if (from === to) {
      this.message.warning('Predecessor and successor tasks must be different.');
      return;
    }

    this.depSubmitting = true;
    
    const dependencyObj = {
      projectId: project,
      fromTaskId: from,
      toTaskId: to,
      type: this.depType,
      lag: this.depLag
    };

    this.createDependencyWithCascading(dependencyObj);
  }
}
