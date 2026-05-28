import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, IDatasource, IGetRowsParams, ModuleRegistry, AllCommunityModule, CellClickedEvent } from 'ag-grid-community';

// Register all AG Grid Community features
ModuleRegistry.registerModules([ AllCommunityModule ]);
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskFormComponent } from '../task-form/task-form.component';
import { TaskStore, Task } from '../../core/state/task-store.service';
import { TaskApiService } from '../../core/services/task-api.service';
import { Subject } from 'rxjs';
import { takeUntil, delay } from 'rxjs/operators';
import { checkDependencyConflict, calculateSuccessorDates } from '../../core/utils/scheduler.utils';

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    NzButtonModule,
    NzIconModule,
    NzTagModule,
    NzPopconfirmModule,
    NzUploadModule,
    NzModalModule,
    PageHeaderComponent,
    TaskFormComponent,
  ],
  template: `
    <app-page-header title="Task Inventory (AG Grid)"></app-page-header>

    <div class="task-table-container">
      <div *ngIf="!selectedProjectId" class="empty-layout">
        <span nz-icon nzType="info-circle" class="empty-icon"></span>
        <h3>Please select a project to view its tasks.</h3>
      </div>

      <div *ngIf="selectedProjectId" class="table-content">
        <!-- Control Header & CSV Ingestion Panel -->
        <div class="table-header-controls">
          <div class="left-actions">
            <button nz-button nzType="primary" (click)="openCreateDrawer()">
              <span nz-icon nzType="plus"></span> Add Task
            </button>
            <span class="page-meta" *ngIf="totalCount > 0">
              Total Database Records: <strong>{{ totalCount }}</strong> Tasks
            </span>
          </div>

          <!-- Bulk CSV Drag & Drop Upload -->
          <div class="csv-upload-section">
            <span class="csv-label">Bulk Performance Test:</span>
            <input
              type="file"
              #csvFileInput
              (change)="onCsvFileSelected($event)"
              accept=".csv"
              style="display: none;"
            />
            <button nz-button nzType="dashed" (click)="csvFileInput.click()" [nzLoading]="csvUploading">
              <span nz-icon nzType="upload"></span> Import CSV (10K+ Tasks)
            </button>
          </div>
        </div>

        <!-- AG Grid Container -->
        <div class="grid-wrapper">
          <ag-grid-angular
            style="width: 100%; height: 500px;"
            class="ag-theme-alpine"
            theme="legacy"
            [columnDefs]="columnDefs"
            [rowModelType]="'infinite'"
            [cacheBlockSize]="cacheBlockSize"
            [maxConcurrentDatasourceRequests]="1"
            [infiniteInitialRowCount]="cacheBlockSize"
            [rowHeight]="44"
            [headerHeight]="40"
            [datasource]="gridDatasource"
            (gridReady)="onGridReady($event)"
            (cellValueChanged)="onCellValueChanged($event)"
            (cellClicked)="onCellClicked($event)"
          ></ag-grid-angular>
        </div>
      </div>
    </div>

    <!-- Task Form Drawer (Create/Edit Context) -->
    <app-task-form
      [visible]="isDrawerVisible"
      [task]="editingTask"
      (close)="closeDrawer()"
      (saved)="onTaskSaved()"
    ></app-task-form>
  `,
  styles: [
    `
      .task-table-container {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 20px;
        box-shadow: var(--shadow-sm);
      }

      .empty-layout {
        text-align: center;
        padding: 80px 40px;
        
        .empty-icon {
          font-size: 40px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        h3 {
          margin: 0;
          color: var(--text-secondary);
          font-size: 15px;
        }
      }

      .table-header-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 12px;
      }

      .left-actions {
        display: flex;
        align-items: center;
        gap: 16px;

        .page-meta {
          font-size: 13px;
          color: var(--text-secondary);
          
          strong {
            color: var(--primary-color);
          }
        }
      }

      .csv-upload-section {
        display: flex;
        align-items: center;
        gap: 8px;

        .csv-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }
      }

      .grid-wrapper {
        border-radius: var(--radius-md);
        overflow: hidden;
        border: 1px solid var(--border-color);
      }

      ::ng-deep {
        /* AG Grid custom styling cells rendering */
        .progress-bar-cell {
          display: flex;
          align-items: center;
          height: 100%;
          width: 100%;
          
          .bar-outer {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
          }
          
          .bar-inner {
            height: 100%;
            background: var(--primary-color);
            border-radius: 4px;
          }
        }

        .action-cell {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 100%;

          button {
            height: 26px;
            padding: 0 8px;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 2px;
            
            span { font-size: 10px; }
          }
        }
      }
    `,
  ],
})
export class TaskTableComponent implements OnInit, OnDestroy {
  public selectedProjectId: string | null = null;
  public totalCount = 0;
  public cacheBlockSize = 50;
  public gridDatasource: IDatasource | undefined = undefined;

  // Drawer Controls
  public isDrawerVisible = false;
  public editingTask: Task | null = null;
  public csvUploading = false;

  private gridApi: any;
  private destroy$ = new Subject<void>();

  // Column definitions for AG Grid
  public columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Task Name',
      minWidth: 160,
      flex: 1,
      sortable: false,
      editable: true,
      cellRenderer: (params: any) => {
        if (params.value === undefined) return '';
        return `<span style="font-weight: 600; color: var(--text-primary);">${params.value || 'Unnamed Task'}</span>`;
      }
    },
    {
      field: 'progress',
      headerName: 'Progress',
      width: 130,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueParser: (params) => Number(params.newValue),
      cellRenderer: (params: any) => {
        if (params.value === undefined) return '';
        return `
          <div class="progress-bar-cell">
            <div class="bar-outer" title="${params.value}%">
              <div class="bar-inner" style="width: ${params.value}%"></div>
            </div>
            <span style="font-size: 11px; margin-left: 8px; font-weight:600; width:30px;">${params.value}%</span>
          </div>
        `;
      },
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 95,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['low', 'medium', 'high'] },
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        const color = params.value === 'high' ? 'red' : params.value === 'medium' ? 'orange' : 'blue';
        return `<span class="ant-tag ant-tag-${color}" style="text-transform: capitalize; font-weight:600;">${params.value}</span>`;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 105,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['todo', 'in_progress', 'done'] },
      cellRenderer: (params: any) => {
        if (!params.value) return '';
        const color = params.value === 'done' ? 'green' : params.value === 'in_progress' ? 'processing' : 'default';
        const label = params.value === 'done' ? 'Done' : params.value === 'in_progress' ? 'In Progress' : 'Todo';
        return `<span class="ant-tag ant-tag-${color}" style="font-weight:600;">${label}</span>`;
      },
    },
    {
      field: 'startDate',
      headerName: 'Start Date',
      width: 130,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const d = new Date(params.value);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      },
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      width: 130,
      editable: true,
      cellEditor: 'agDateCellEditor',
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        const d = new Date(params.value);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
      },
    },
    { 
      field: 'duration', 
      headerName: 'Duration', 
      width: 95, 
      editable: false,
      valueFormatter: (params) => params.value !== undefined ? `${params.value} d` : '' 
    },
    {
      field: 'isMilestone',
      headerName: 'Milestone',
      width: 90,
      cellRenderer: (params: any) => {
        return params.value ? `<span class="ant-tag ant-tag-magenta" style="font-weight:600;">Milestone</span>` : 'No';
      },
    },
    {
      headerName: 'Assigned',
      width: 150,
      valueGetter: (params: any) => {
        if (!params.data || !params.data.resourceIds) return '';
        // Return resource names combined
        if (params.data.resources) {
          return params.data.resources.map((r: any) => r.name).join(', ');
        }
        return '';
      },
      cellRenderer: (params: any) => {
        if (!params.data || !params.data.resources || params.data.resources.length === 0) return '-';
        return params.data.resources
          .map((r: any) => `<span class="ant-tag ant-tag-blue" style="font-size:10px; margin: 2px;">${r.name}</span>`)
          .join('');
      },
    },
    {
      headerName: 'Actions',
      width: 140,
      pinned: 'right',
      cellRenderer: (params: any) => {
        if (!params.data) return '';
        // Inject placeholder buttons that are caught dynamically inside cell click listener
        return `
          <div class="action-cell">
            <button class="ant-btn ant-btn-default edit-btn-trigger">
              <span class="anticon anticon-edit"></span> Edit
            </button>
            <button class="ant-btn ant-btn-dashed ant-btn-dangerous delete-btn-trigger">
              <span class="anticon anticon-delete"></span> Del
            </button>
          </div>
        `;
      },
    },
  ];

  constructor(
    private store: TaskStore,
    private taskApi: TaskApiService,
    private message: NzMessageService,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Listen to selected project
    this.store.selectedProjectId$.pipe(
      delay(0),
      takeUntil(this.destroy$)
    ).subscribe(id => {
      if (id === this.selectedProjectId && this.gridDatasource) {
        return;
      }
      this.selectedProjectId = id;
      if (id) {
        this.gridDatasource = this.createDatasource();
      } else {
        this.gridDatasource = undefined;
      }
      this.cdr.markForCheck();
    });

    // Listen to pagination updates
    this.store.pagination$.pipe(
      delay(0),
      takeUntil(this.destroy$)
    ).subscribe(pag => {
      this.totalCount = pag.total;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    
    // Register Infinite Scroll Datasource
    if (this.selectedProjectId) {
      this.gridDatasource = this.createDatasource();
      this.cdr.markForCheck();
    }
  }

  public onCellClicked(event: CellClickedEvent): void {
    const target = event.event?.target as HTMLElement;
    if (!target) return;

    const isEditClick = target.classList.contains('edit-btn-trigger') || target.closest('.edit-btn-trigger');
    const isDeleteClick = target.classList.contains('delete-btn-trigger') || target.closest('.delete-btn-trigger');
    
    if (isEditClick && event.data) {
      this.openEditDrawer(event.data);
    } else if (isDeleteClick && event.data) {
      const taskId = event.data._id || event.data.id;
      if (taskId) {
        const confirmed = confirm(`Are you sure you want to delete the task "${event.data.name || 'this task'}"?`);
        if (confirmed) {
          this.deleteTask(taskId);
        }
      }
    }
  }

  public onCellValueChanged(event: any): void {
    const { data } = event;
    if (!data) return;

    const taskId = data._id || data.id;
    if (!taskId) return;

    const formatDateOnly = (dateVal: any): string => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startStr = data.startDate ? formatDateOnly(data.startDate) : '';
    const endStr = data.endDate ? formatDateOnly(data.endDate) : '';

    if (startStr && endStr && new Date(endStr) < new Date(startStr)) {
      this.message.error('End date cannot be before start date!');
      this.gridDatasource = this.createDatasource();
      this.cdr.markForCheck();
      return;
    }

    if (data.progress !== undefined && data.progress !== null) {
      const progressNum = Number(data.progress);
      if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
        this.message.error('Progress must be a number between 0 and 100!');
        this.gridDatasource = this.createDatasource();
        this.cdr.markForCheck();
        return;
      }
    }

    const milestone = !!data.isMilestone;
    if (startStr && endStr && startStr === endStr && !milestone) {
      this.message.warning('Same start and end date on a normal task is usually reserved for Milestones.');
    }

    const duration = milestone ? 0 : this.calculateDuration(startStr, endStr);

    const payload: Partial<Task> = {
      name: data.name,
      progress: data.progress !== undefined ? Number(data.progress) : undefined,
      priority: data.priority,
      status: data.status,
      startDate: startStr || undefined,
      endDate: endStr || undefined,
      duration: duration,
    };

    // Clean payload of undefined fields
    Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

    // Check dependency conflicts
    const deps = this.store.getSnapshot().dependencies;
    const taskA = { ...data, ...payload };

    const checkPredecessors = () => {
      const predecessors = deps.filter(d => String(d.toTaskId) === String(taskId));
      let foundPredConflict = false;
      let predTask = null;
      let predDep = null;

      for (const dep of predecessors) {
        const predId = String(dep.fromTaskId);
        const originalPred = this.store.getSnapshot().tasks.find(t => String(t._id || t.id) === predId);
        if (originalPred) {
          const hasConflict = checkDependencyConflict(originalPred, taskA, dep.type, dep.lag);
          if (hasConflict) {
            foundPredConflict = true;
            predTask = originalPred;
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
            payload.startDate = newDates.startDate;
            payload.endDate = newDates.endDate;
            taskA.startDate = newDates.startDate;
            taskA.endDate = newDates.endDate;
            
            // Recheck successors with updated dates
            checkSuccessors();
          },
          nzOnCancel: () => {
            this.message.warning(`Dependency Conflict Warning: Task "${taskA.name}" violates predecessor constraint.`);
            checkSuccessors();
          }
        });
      } else {
        checkSuccessors();
      }
    };

    const checkSuccessors = () => {
      const successors = deps.filter(d => String(d.fromTaskId) === String(taskId));
      let foundSuccConflict = false;
      let successorTask = null;
      let conflictingDep = null;

      for (const dep of successors) {
        const succId = String(dep.toTaskId);
        const originalSucc = this.store.getSnapshot().tasks.find(t => String(t._id || t.id) === succId);
        if (originalSucc) {
          const hasConflict = checkDependencyConflict(taskA, originalSucc, dep.type, dep.lag);
          if (hasConflict) {
            foundSuccConflict = true;
            successorTask = originalSucc;
            conflictingDep = dep;
            break;
          }
        }
      }

      if (foundSuccConflict && successorTask && conflictingDep) {
        this.modal.confirm({
          nzTitle: 'Dependency Conflict Warning',
          nzContent: `Task "${successorTask.name}" depends on Task "${data.name || 'Predecessor'}". Do you want to auto-adjust dependent tasks?`,
          nzOkText: 'Yes',
          nzCancelText: 'No',
          nzOnOk: () => {
            const tasksToSave = [{ id: taskId, ...payload }];
            
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
                const nextChild = this.store.getSnapshot().tasks.find(t => String(t._id || t.id) === nextChildId);
                if (nextChild) {
                  const existingNextInSave = tasksToSave.find(t => String(t.id || t._id) === nextChildId);
                  const mergedNextChild = existingNextInSave ? { ...nextChild, ...existingNextInSave } : nextChild;
                  adjustSuccessor(childUpdate, mergedNextChild, cd);
                }
              }
            };

            adjustSuccessor(taskA, successorTask, conflictingDep);
            performSave(tasksToSave);
          },
          nzOnCancel: () => {
            this.message.warning(`Dependency Conflict Warning: Task "${successorTask.name}" depends on Task "${data.name || 'Predecessor'}" and is in conflict.`);
            performSave([{ id: taskId, ...payload }]);
          }
        });
      } else {
        performSave([{ id: taskId, ...payload }]);
      }
    };

    const performSave = (tasksToSave: any[]) => {
      const msgId = this.message.loading('Saving changes to MongoDB...', { nzDuration: 0 }).messageId;
      this.taskApi.bulkUpdateTasks(tasksToSave).subscribe({
        next: () => {
          this.message.remove(msgId);
          this.message.success(`Saved successfully!`);
          
          this.store.localUpdateTasks(tasksToSave);

          if (this.selectedProjectId) {
            this.taskApi.getTasks(this.selectedProjectId).subscribe(taskList => {
              this.store.setTasks(taskList);
            });
          }
          this.gridDatasource = this.createDatasource();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.message.remove(msgId);
          this.message.error(err.error?.message || err.message || 'Failed to save changes');
          this.gridDatasource = this.createDatasource();
          this.cdr.markForCheck();
        }
      });
    };

    // Kickoff validation cascade
    checkPredecessors();
  }

  private calculateDuration(startDate: any, endDate: any): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // --- AG Grid Infinite Row Model Datasource Definition ---
  private createDatasource(): IDatasource {
    return {
      getRows: (params: IGetRowsParams) => {
        const projectId = this.selectedProjectId;
        if (!projectId) {
          params.successCallback([], 0);
          return;
        }

        // Calculate page index from startRow index
        const limit = this.cacheBlockSize;
        const page = Math.floor(params.startRow / limit) + 1;

        console.log(`Lazy loading Tasks offset page: ${page}, block limit: ${limit}, projectId: ${projectId}`);
        
        this.store.setLoading(true);
        this.taskApi.getPaginatedTasks(projectId, page, limit).subscribe({
          next: (res) => {
            console.log('getPaginatedTasks successfully loaded tasks:', res.tasks, 'total:', res.total);
            this.store.setLoading(false);
            this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
            
            // Return rows back to AG Grid virtual container
            params.successCallback(res.tasks, res.total);
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('getPaginatedTasks failed:', err);
            this.store.setError(err.message || 'Failed loading paginated tasks');
            this.store.setLoading(false);
            params.failCallback();
            this.cdr.markForCheck();
          },
        });
      },
    };
  }

  // Safe setter for AG Grid datasource (supporting multiple API versions)
  private setGridDatasource(datasource: IDatasource): void {
    if (!this.gridApi) return;
    if (typeof this.gridApi.setGridOption === 'function') {
      this.gridApi.setGridOption('datasource', datasource);
    } else if (typeof this.gridApi.setDatasource === 'function') {
      this.gridApi.setDatasource(datasource);
    }
  }

  // Task form drawer triggers
  public openCreateDrawer(): void {
    this.editingTask = null;
    this.isDrawerVisible = true;
  }

  public openEditDrawer(task: Task): void {
    this.editingTask = task;
    this.isDrawerVisible = true;
  }

  public closeDrawer(): void {
    this.isDrawerVisible = false;
    this.editingTask = null;
  }

  public onTaskSaved(): void {
    this.gridDatasource = this.createDatasource();
    this.cdr.markForCheck();
  }

  public deleteTask(id: string): void {
    this.taskApi.deleteTask(id).subscribe({
      next: () => {
        this.message.success('Task deleted successfully!');
        this.store.localDeleteTask(id);
        
        // Trigger grid block refreshing
        this.gridDatasource = this.createDatasource();

        // Also refresh projects flat tasks list (for Gantt)
        if (this.selectedProjectId) {
          this.taskApi.getTasks(this.selectedProjectId).subscribe(taskList => {
            this.store.setTasks(taskList);
          });
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.message.error(err.message || 'Failed deleting task');
      },
    });
  }

  // --- Bulk CSV Ingestion Parsing & Syncing ---
  public onCsvFileSelected(event: any): void {
    const file = event.target.files[0];
    const projectId = this.selectedProjectId;
    
    if (!file || !projectId) return;

    this.csvUploading = true;
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const text = e.target.result;
      const parsedTasks = this.parseCSVText(text);

      if (parsedTasks.length === 0) {
        this.message.error('Could not parse any valid tasks from CSV. Ensure headers exist.');
        this.csvUploading = false;
        return;
      }

      const loader = this.message.loading(`Uploading ${parsedTasks.length} tasks in bulk...`, { nzDuration: 0 });
      const msgId = loader.messageId;

      // Run bulk HTTP post to Express backend
      this.taskApi.importCSV(projectId, parsedTasks).subscribe({
        next: (res) => {
          this.message.remove(msgId); // Dismiss loader
          this.message.success(res.message);
          this.csvUploading = false;
          
          // Re-sync entire project schedule and refresh AG Grid datasource
          this.gridDatasource = this.createDatasource();
          this.cdr.markForCheck();
          
          this.taskApi.getTasks(projectId).subscribe((tasksList) => {
            this.store.setTasks(tasksList);
          });
          this.taskApi.getDependencies(projectId).subscribe((depList) => {
            this.store.setDependencies(depList);
          });
        },
        error: (err) => {
          this.message.remove(msgId);
          this.message.error(err.message || 'Error executing bulk CSV upload');
          this.csvUploading = false;
        },
      });
    };

    reader.readAsText(file);
    // Reset file input value
    event.target.value = '';
  }

  private parseCSVDate(dateStr: string): string {
    if (!dateStr) return '';
    const clean = dateStr.trim();
    
    // 1. Match DD/MM/YYYY or DD-MM-YYYY
    const matchesDmY = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchesDmY) {
      const day = matchesDmY[1].padStart(2, '0');
      const month = matchesDmY[2].padStart(2, '0');
      const year = matchesDmY[3];
      return `${year}-${month}-${day}`; // Convert to YYYY-MM-DD
    }
    
    // 2. Match YYYY-MM-DD
    const matchesYmD = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (matchesYmD) {
      const year = matchesYmD[1];
      const month = matchesYmD[2].padStart(2, '0');
      const day = matchesYmD[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // 3. Fallback standard parsing
    const d = new Date(clean);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseCSVText(text: string): Partial<Task>[] {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) return [];

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const tasks: Partial<Task>[] = [];
    let failedRows = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      if (values.length < headers.length) continue;

      const task: any = {};
      headers.forEach((header, index) => {
        const val = values[index];
        if (header === 'id' || header === 'tempCsvId') task.tempCsvId = val;
        else if (header === 'parentId' || header === 'tempCsvParentId') task.tempCsvParentId = val || null;
        else if (header === 'name') task.name = val;
        else if (header === 'description') task.description = val;
        else if (header === 'startDate') task.startDate = this.parseCSVDate(val);
        else if (header === 'endDate') task.endDate = this.parseCSVDate(val);
        else if (header === 'duration') task.duration = Number(val);
        else if (header === 'progress') task.progress = Number(val) || 0;
        else if (header === 'priority') task.priority = val;
        else if (header === 'status') task.status = val;
        else if (header === 'isMilestone') task.isMilestone = val ? val.toLowerCase() === 'true' : false;
        else if (header === 'dependencyIds' || header === 'dependencies' || header === 'predecessorIds' || header === 'tempCsvDependencyIds') {
          task.tempCsvDependencyIds = val || null;
        }
      });

      // Strict Row Validation
      if (!task.name) {
        console.error(`CSV Ingestion Error [Row ${i}]: Missing task name`);
        failedRows++;
        continue;
      }
      if (!task.startDate || !task.endDate) {
        console.error(`CSV Ingestion Error [Row ${i}]: Missing or invalid date format`);
        failedRows++;
        continue;
      }
      if (new Date(task.endDate) < new Date(task.startDate)) {
        console.error(`CSV Ingestion Error [Row ${i}]: End date cannot be before start date`);
        failedRows++;
        continue;
      }

      tasks.push(task);
    }

    if (failedRows > 0) {
      this.message.warning(`CSV Ingestion: ${failedRows} failed row(s) skipped. Check console.`);
    }

    return tasks;
  }
}
