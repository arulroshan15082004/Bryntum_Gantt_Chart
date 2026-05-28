import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskStore, Task, Dependency } from '../../core/state/task-store.service';
import { TaskApiService } from '../../core/services/task-api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { checkDependencyConflict, calculateSuccessorDates } from '../../core/utils/scheduler.utils';

@Component({
  selector: 'app-dependencies',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzGridModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTagModule,
    NzTableModule,
    NzSelectModule,
    NzModalModule,
    PageHeaderComponent
  ],
  template: `
    <app-page-header title="Dependency Hub"></app-page-header>

    <div class="dependency-hub-container">
      <div *ngIf="!selectedProjectId" class="empty-layout">
        <span nz-icon nzType="project" class="empty-icon"></span>
        <h3>Please select a project to manage its scheduling dependencies.</h3>
      </div>

      <div *ngIf="selectedProjectId" nz-row [nzGutter]="24">
        <!-- Dependency Editor Panel (Left) -->
        <div nz-col [nzXs]="24" [nzLg]="8">
          <div class="enterprise-card sticky-panel">
            <h3 class="panel-title">{{ isEditMode ? 'Edit' : 'Add' }} Dependency Link</h3>
            <p class="panel-subtitle">Define chronological constraints between project tasks.</p>

            <form nz-form [formGroup]="depForm" (ngSubmit)="onSubmit()" nzLayout="vertical">
              <nz-form-item>
                <nz-form-label nzRequired nzFor="fromTaskId">Predecessor Task</nz-form-label>
                <nz-form-control nzErrorTip="Please select predecessor task!">
                  <nz-select
                    formControlName="fromTaskId"
                    id="fromTaskId"
                    nzShowSearch
                    nzPlaceHolder="Search predecessor task"
                    [nzDisabled]="isEditMode"
                  >
                    <nz-option *ngFor="let t of tasks" [nzValue]="t._id || t.id" [nzLabel]="t.name"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired nzFor="toTaskId">Successor Task</nz-form-label>
                <nz-form-control nzErrorTip="Please select successor task!">
                  <nz-select
                    formControlName="toTaskId"
                    id="toTaskId"
                    nzShowSearch
                    nzPlaceHolder="Search successor task"
                    [nzDisabled]="isEditMode"
                  >
                    <nz-option *ngFor="let t of tasks" [nzValue]="t._id || t.id" [nzLabel]="t.name"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired nzFor="type">Dependency Type</nz-form-label>
                <nz-form-control nzErrorTip="Please select dependency type!">
                  <nz-select formControlName="type" id="type">
                    <nz-option nzValue="FS" nzLabel="Finish-to-Start (FS)"></nz-option>
                    <nz-option nzValue="SS" nzLabel="Start-to-Start (SS)"></nz-option>
                    <nz-option nzValue="FF" nzLabel="Finish-to-Finish (FF)"></nz-option>
                    <nz-option nzValue="SF" nzLabel="Start-to-Finish (SF)"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label nzRequired nzFor="lag">Lag (Days)</nz-form-label>
                <nz-form-control nzErrorTip="Lag is required!">
                  <nz-input-number
                    formControlName="lag"
                    id="lag"
                    [nzStep]="1"
                    class="full-width"
                  ></nz-input-number>
                </nz-form-control>
              </nz-form-item>

              <div class="form-actions">
                <button
                  nz-button
                  nzType="primary"
                  type="submit"
                  [nzLoading]="submitting"
                  [disabled]="depForm.invalid"
                  class="submit-btn"
                >
                  <span nz-icon [nzType]="isEditMode ? 'save' : 'plus'"></span>
                  {{ isEditMode ? 'Update' : 'Add' }} Link
                </button>
                <button
                  *ngIf="isEditMode"
                  nz-button
                  nzType="default"
                  type="button"
                  (click)="cancelEdit()"
                  class="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Dependency List Panel (Right) -->
        <div nz-col [nzXs]="24" [nzLg]="16">
          <div class="enterprise-card list-panel">
            <h3 class="panel-title">Active Dependency Links</h3>
            <p class="panel-subtitle">Manage scheduling links for the active project.</p>

            <nz-table
              #depTable
              [nzData]="dependencies"
              [nzLoading]="loading"
              nzSize="middle"
              [nzPageSize]="10"
              class="enterprise-table"
            >
              <thead>
                <tr>
                  <th>Predecessor</th>
                  <th>Successor</th>
                  <th>Type</th>
                  <th>Lag (Days)</th>
                  <th nzWidth="150px">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let data of depTable.data">
                  <td>
                    <span class="task-name-cell">
                      <span nz-icon nzType="right-square" nzTheme="twotone"></span>
                      {{ getTaskName(data.fromTaskId) }}
                    </span>
                  </td>
                  <td>
                    <span class="task-name-cell">
                      <span nz-icon nzType="left-square" nzTheme="twotone" nzTwotoneColor="#eb2f96"></span>
                      {{ getTaskName(data.toTaskId) }}
                    </span>
                  </td>
                  <td>
                    <nz-tag [nzColor]="getTypeColor(data.type)">{{ data.type }}</nz-tag>
                  </td>
                  <td>
                    <nz-tag [nzColor]="data.lag > 0 ? 'blue' : 'default'">{{ data.lag }} days</nz-tag>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button nz-button nzType="text" (click)="editDependency(data)" nzTitle="Edit dependency">
                        <span nz-icon nzType="edit"></span>
                      </button>
                      <button
                        nz-button
                        nzType="text"
                        nzDanger
                        nz-popconfirm
                        nzPopconfirmTitle="Are you sure you want to delete this dependency link?"
                        (nzOnConfirm)="deleteDependency((data._id || data.id)!)"
                        nzTitle="Delete dependency"
                      >
                        <span nz-icon nzType="delete"></span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </nz-table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dependency-hub-container {
        padding: 20px;
        min-height: calc(100vh - 160px);
      }

      .sticky-panel {
        position: sticky;
        top: 20px;
      }

      .panel-title {
        font-size: 16px;
        margin-bottom: 4px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .panel-subtitle {
        color: var(--text-secondary);
        font-size: 12px;
        margin-bottom: 20px;
      }

      .full-width {
        width: 100%;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 24px;
        
        .submit-btn {
          flex-grow: 1;
        }
      }

      .empty-layout {
        text-align: center;
        padding: 80px 40px;
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);

        .empty-icon {
          font-size: 48px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        h3 {
          margin: 0;
          color: var(--text-secondary);
          font-size: 15px;
        }
      }

      .enterprise-card {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 24px;
        box-shadow: var(--shadow-sm);
        margin-bottom: 24px;
      }

      .task-name-cell {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .table-actions {
        display: flex;
        gap: 4px;
      }

      .enterprise-table ::ng-deep .ant-table-thead > tr > th {
        background: var(--bg-hover) !important;
        font-weight: 600;
      }
    `
  ]
})
export class DependenciesComponent implements OnInit, OnDestroy {
  public depForm!: FormGroup;
  public selectedProjectId: string | null = null;
  public tasks: Task[] = [];
  public dependencies: Dependency[] = [];
  public loading = false;
  public submitting = false;
  public isEditMode = false;
  public editingDep: Dependency | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private store: TaskStore,
    private taskApi: TaskApiService,
    private message: NzMessageService,
    private modal: NzModalService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // 1. Listen to selected project
    this.store.selectedProjectId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        this.selectedProjectId = id;
        this.cancelEdit();
        if (id) {
          this.fetchDependencies();
        } else {
          this.dependencies = [];
          this.tasks = [];
        }
        this.cdr.markForCheck();
      });

    // 2. Listen to tasks list
    this.store.tasks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasksList => {
        this.tasks = tasksList;
        this.cdr.markForCheck();
      });

    // 3. Listen to dependencies list
    this.store.dependencies$
      .pipe(takeUntil(this.destroy$))
      .subscribe(depsList => {
        this.dependencies = depsList;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.depForm = this.fb.group({
      fromTaskId: ['', [Validators.required]],
      toTaskId: ['', [Validators.required]],
      type: ['FS', [Validators.required]],
      lag: [0, [Validators.required]]
    });
  }

  private fetchDependencies(): void {
    if (!this.selectedProjectId) return;
    this.loading = true;
    this.taskApi.getDependencies(this.selectedProjectId).subscribe({
      next: (deps) => {
        this.store.setDependencies(deps);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed fetching dependencies:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  public onSubmit(): void {
    if (this.depForm.invalid || !this.selectedProjectId) return;

    const { fromTaskId, toTaskId, type, lag } = this.depForm.value;

    // --- Validation Rules ---
    // 1. Self Dependency
    if (fromTaskId === toTaskId) {
      this.message.error('A task cannot depend on itself.');
      return;
    }

    // 2. Decimal Lag
    if (!Number.isInteger(Number(lag))) {
      this.message.error('Lag must be a whole number.');
      return;
    }

    // Get snapshot of current dependencies
    const currentDeps = this.store.getSnapshot().dependencies;

    // 4. Duplicate Dependency check
    const duplicate = currentDeps.find(d => 
      (this.isEditMode ? (d._id !== this.editingDep?._id && d.id !== this.editingDep?.id) : true) &&
      String(d.fromTaskId) === String(fromTaskId) && 
      String(d.toTaskId) === String(toTaskId)
    );
    if (duplicate) {
      this.message.error('Dependency already exists between these tasks.');
      return;
    }

    // 5. Circular Dependency check
    const hasCircularPath = (startId: string, targetId: string): boolean => {
      const directDeps = currentDeps.filter(d => 
        (this.isEditMode ? (d._id !== this.editingDep?._id && d.id !== this.editingDep?.id) : true) &&
        String(d.fromTaskId) === String(startId)
      );
      for (const dep of directDeps) {
        const nextId = String(dep.toTaskId);
        if (nextId === targetId) return true;
        if (hasCircularPath(nextId, targetId)) return true;
      }
      return false;
    };

    if (hasCircularPath(toTaskId, fromTaskId)) {
      this.message.error('Circular dependency detected.');
      return;
    }

    const taskA = this.tasks.find(t => String(t._id || t.id) === String(fromTaskId));
    const taskB = this.tasks.find(t => String(t._id || t.id) === String(toTaskId));

    if (!taskA || !taskB) {
      this.message.error('One or both selected tasks were not found.');
      return;
    }

    this.submitting = true;
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
        (this.isEditMode ? (d._id !== this.editingDep?._id && d.id !== this.editingDep?.id) : true) &&
        String(d.fromTaskId) === String(childTask._id || childTask.id)
      );
      for (const cd of childSuccessors) {
        const nextChildId = String(cd.toTaskId);
        const nextChild = this.tasks.find(t => String(t._id || t.id) === nextChildId);
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
        if (this.isEditMode && this.editingDep) {
          const depId = (this.editingDep._id || this.editingDep.id)!;
          this.taskApi.updateDependency(depId, { type, lag }).subscribe({
            next: (updatedDep) => {
              this.message.success('Dependency updated successfully.');
              this.store.localUpdateDependency(updatedDep);
              this.cancelEdit();
              this.submitting = false;
              this.refreshAll();
            },
            error: (err) => {
              this.message.error(err.error?.message || err.message || 'Failed to update dependency.');
              this.submitting = false;
              this.cdr.markForCheck();
            }
          });
        } else {
          const dependencyPayload = {
            projectId: this.selectedProjectId!,
            fromTaskId,
            toTaskId,
            type,
            lag
          };
          this.taskApi.createDependency(dependencyPayload).subscribe({
            next: (newDep) => {
              this.message.success('Dependency link added.');
              this.store.localAddDependency(newDep);
              this.depForm.reset({ type: 'FS', lag: 0 });
              this.submitting = false;
              this.refreshAll();
            },
            error: (err) => {
              this.message.error(err.error?.message || err.message || 'Failed to create dependency.');
              this.submitting = false;
              this.cdr.markForCheck();
            }
          });
        }
      };

      if (tasksToSave.length > 0) {
        this.taskApi.bulkUpdateTasks(tasksToSave).subscribe({
          next: () => {
            this.store.localUpdateTasks(tasksToSave);
            executeSave();
          },
          error: (err) => {
            this.message.error(err.error?.message || err.message || 'Failed to shift task dates.');
            this.submitting = false;
            this.cdr.markForCheck();
          }
        });
      } else {
        executeSave();
      }
    };

    performSaveDependency();
  }

  public editDependency(dep: Dependency): void {
    this.isEditMode = true;
    this.editingDep = dep;
    this.depForm.patchValue({
      fromTaskId: dep.fromTaskId,
      toTaskId: dep.toTaskId,
      type: dep.type,
      lag: dep.lag
    });
    this.cdr.markForCheck();
  }

  public cancelEdit(): void {
    this.isEditMode = false;
    this.editingDep = null;
    this.depForm.reset({ type: 'FS', lag: 0 });
    this.cdr.markForCheck();
  }

  public deleteDependency(id: string): void {
    this.taskApi.deleteDependency(id).subscribe({
      next: () => {
        this.message.success('Dependency link deleted.');
        this.store.localDeleteDependency(id);
        this.refreshAll();
      },
      error: (err) => {
        this.message.error(err.error?.message || err.message || 'Failed to delete dependency.');
      }
    });
  }

  private refreshAll(): void {
    if (this.selectedProjectId) {
      this.taskApi.getTasks(this.selectedProjectId).subscribe(taskList => {
        this.store.setTasks(taskList);
      });
      const pag = this.store.getSnapshot().pagination;
      this.taskApi.getPaginatedTasks(this.selectedProjectId, pag.page, pag.limit).subscribe(res => {
        this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
      });
    }
  }

  // UI Helpers
  public getTaskName(id: string): string {
    const task = this.tasks.find(t => String(t._id || t.id) === String(id));
    return task ? task.name : 'Unknown Task';
  }

  public getTypeColor(type: string): string {
    switch (type) {
      case 'FS': return 'orange';
      case 'SS': return 'green';
      case 'FF': return 'blue';
      case 'SF': return 'purple';
      default: return 'default';
    }
  }
}
