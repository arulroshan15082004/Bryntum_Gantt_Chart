import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { TaskStore, Task, Resource } from '../../core/state/task-store.service';
import { TaskApiService } from '../../core/services/task-api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { calculateSuccessorDates } from '../../core/utils/scheduler.utils';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    NzCheckboxModule,
    NzButtonModule,
    NzSliderModule,
    NzInputNumberModule,
  ],
  template: `
    <nz-drawer
      [nzBodyStyle]="{ overflow: 'auto' }"
      [nzMaskClosable]="true"
      [nzWidth]="420"
      [nzVisible]="visible"
      [nzTitle]="task ? 'Edit Task: ' + task.name : 'Create New Task'"
      (nzOnClose)="closeForm()"
    >
      <form nz-form [formGroup]="taskForm" *nzDrawerContent (ngSubmit)="submitForm()">
        <!-- Task Name -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzRequired nzFor="name">Task Name</nz-form-label>
          <nz-form-control [nzSpan]="24" nzErrorTip="Please enter the task name!">
            <input nz-input formControlName="name" id="name" placeholder="Enter task name" />
          </nz-form-control>
        </nz-form-item>

        <!-- Description -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzFor="description">Description</nz-form-label>
          <nz-form-control [nzSpan]="24">
            <textarea
              nz-input
              formControlName="description"
              id="description"
              placeholder="Enter task description"
              rows="3"
            ></textarea>
          </nz-form-control>
        </nz-form-item>

        <!-- Parent Task Selection -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzFor="parentId">Parent Task (Hierarchy)</nz-form-label>
          <nz-form-control [nzSpan]="24">
            <nz-select
              formControlName="parentId"
              id="parentId"
              nzPlaceHolder="None (Root Task)"
              nzShowSearch
              nzAllowClear
            >
              <nz-option
                *ngFor="let pTask of availableParentTasks"
                [nzValue]="pTask._id || pTask.id"
                [nzLabel]="pTask.name"
              ></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <!-- Start Date -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzRequired nzFor="startDate">Start Date</nz-form-label>
          <nz-form-control [nzSpan]="24" nzErrorTip="Please select a start date!">
            <nz-date-picker
              formControlName="startDate"
              class="date-picker"
              (ngModelChange)="onDateChange()"
            ></nz-date-picker>
          </nz-form-control>
        </nz-form-item>

        <!-- End Date -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzRequired nzFor="endDate">End Date</nz-form-label>
          <nz-form-control [nzSpan]="24" [nzErrorTip]="endDateErrorTip">
            <nz-date-picker
              formControlName="endDate"
              class="date-picker"
              (ngModelChange)="onDateChange()"
            ></nz-date-picker>
            <ng-template #endDateErrorTip let-control>
              <ng-container *ngIf="control.hasError('required')">Please select an end date!</ng-container>
              <ng-container *ngIf="control.hasError('dateOrder')">End date cannot be before start date!</ng-container>
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <!-- Duration (Days) -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzFor="duration">Duration (Days)</nz-form-label>
          <nz-form-control [nzSpan]="24">
            <input
              nz-input
              type="number"
              formControlName="duration"
              id="duration"
              placeholder="Calculated automatically"
              readonly
            />
          </nz-form-control>
        </nz-form-item>

        <!-- Progress Slider -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzFor="progress">Progress: {{ taskForm.value.progress }}%</nz-form-label>
          <nz-form-control [nzSpan]="24">
            <nz-slider formControlName="progress" [nzMin]="0" [nzMax]="100"></nz-slider>
          </nz-form-control>
        </nz-form-item>

        <!-- Resource Assignment -->
        <nz-form-item>
          <nz-form-label [nzSpan]="24" nzFor="resourceIds">Assign Resources</nz-form-label>
          <nz-form-control [nzSpan]="24">
            <nz-select
              formControlName="resourceIds"
              id="resourceIds"
              nzMode="multiple"
              nzPlaceHolder="Select resources"
            >
              <nz-option
                *ngFor="let res of resources"
                [nzValue]="res._id || res.id"
                [nzLabel]="res.name + ' (' + res.role + ')'"
              ></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <!-- Status & Priority (Side-by-Side) -->
        <div class="side-by-side">
          <nz-form-item class="half-width">
            <nz-form-label nzFor="status">Status</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="status" id="status">
                <nz-option nzValue="todo" nzLabel="Todo"></nz-option>
                <nz-option nzValue="in_progress" nzLabel="In Progress"></nz-option>
                <nz-option nzValue="done" nzLabel="Done"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item class="half-width">
            <nz-form-label nzFor="priority">Priority</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="priority" id="priority">
                <nz-option nzValue="low" nzLabel="Low"></nz-option>
                <nz-option nzValue="medium" nzLabel="Medium"></nz-option>
                <nz-option nzValue="high" nzLabel="High"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </div>

        <!-- Milestone Checkbox -->
        <nz-form-item>
          <nz-form-control>
            <label nz-checkbox formControlName="isMilestone">Mark as Milestone (Zero Duration)</label>
          </nz-form-control>
        </nz-form-item>

        <!-- Optional Dependency Section (Only for Create Mode) -->
        <div *ngIf="!task">
          <h4 style="margin-top: 16px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; font-weight: 600;">Add dependency?</h4>
          
          <nz-form-item>
            <nz-form-label [nzSpan]="24" nzFor="depPredecessorId">Predecessor task</nz-form-label>
            <nz-form-control [nzSpan]="24">
              <nz-select
                formControlName="depPredecessorId"
                id="depPredecessorId"
                nzPlaceHolder="None (Independent task)"
                nzShowSearch
                nzAllowClear
              >
                <nz-option
                  *ngFor="let t of availableParentTasks"
                  [nzValue]="t._id || t.id"
                  [nzLabel]="t.name"
                ></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <div class="side-by-side">
            <nz-form-item class="half-width">
              <nz-form-label nzFor="depType">Dependency type</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="depType" id="depType">
                  <nz-option nzValue="FS" nzLabel="Finish-to-Start (FS)"></nz-option>
                  <nz-option nzValue="SS" nzLabel="Start-to-Start (SS)"></nz-option>
                  <nz-option nzValue="FF" nzLabel="Finish-to-Finish (FF)"></nz-option>
                  <nz-option nzValue="SF" nzLabel="Start-to-Finish (SF)"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item class="half-width">
              <nz-form-label nzFor="depLag">Lag days</nz-form-label>
              <nz-form-control>
                <nz-input-number
                  formControlName="depLag"
                  id="depLag"
                  [nzStep]="1"
                  style="width: 100%;"
                ></nz-input-number>
              </nz-form-control>
            </nz-form-item>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="drawer-actions">
          <button nz-button type="button" (click)="closeForm()" style="margin-right: 8px;">Cancel</button>
          <button nz-button nzType="primary" type="submit" [nzLoading]="submitting" [disabled]="taskForm.invalid">
            Save Task
          </button>
        </div>
      </form>
    </nz-drawer>
  `,
  styles: [
    `
      .date-picker {
        width: 100%;
      }

      .side-by-side {
        display: flex;
        gap: 16px;
        justify-content: space-between;
      }

      .half-width {
        flex: 1;
      }

      .drawer-actions {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: #ffffff;
        border-top: 1px solid var(--border-color);
        padding: 12px 24px;
        text-align: right;
        z-index: 10;
      }
    `,
  ],
})
export class TaskFormComponent implements OnInit, OnDestroy {
  @Input() visible: boolean = false;
  @Input() task: Task | null = null; // null for Create, Task object for Edit
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  public taskForm!: FormGroup;
  public resources: Resource[] = [];
  public availableParentTasks: Task[] = [];
  public submitting: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private store: TaskStore,
    private taskApi: TaskApiService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Sync resources list
    this.store.resources$.pipe(takeUntil(this.destroy$)).subscribe(resList => {
      this.resources = resList;
      this.cdr.markForCheck();
    });

    // Watch tasks to populate possible parent tasks (excluding current task to avoid recursion!)
    this.store.tasks$.pipe(takeUntil(this.destroy$)).subscribe(taskList => {
      if (this.visible) {
        this.updateAvailableParents(taskList);
        this.cdr.markForCheck();
      }
    });

    // Re-patch form values if task input changes (e.g. when opening edit mode)
    if (this.task) {
      this.patchFormValues(this.task);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Pre-fill form if editing an existing task
  ngOnChanges(): void {
    if (this.visible && this.taskForm) {
      this.updateAvailableParents(this.store.getSnapshot().tasks);
      if (this.task) {
        this.patchFormValues(this.task);
      } else {
        this.taskForm.reset({
          priority: 'medium',
          status: 'todo',
          progress: 0,
          isMilestone: false,
          resourceIds: [],
        });
      }
      this.cdr.markForCheck();
    }
  }

  private initForm(): void {
    this.taskForm = this.fb.group(
      {
        name: ['', [Validators.required]],
        description: [''],
        parentId: [null],
        startDate: [null, [Validators.required]],
        endDate: [null, [Validators.required]],
        duration: [{ value: 1, disabled: true }],
        progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
        priority: ['medium', [Validators.required]],
        status: ['todo', [Validators.required]],
        isMilestone: [false],
        resourceIds: [[]],
        depPredecessorId: [null],
        depType: ['FS'],
        depLag: [0],
      },
      { validators: this.dateOrderValidator }
    );

    // Dynamic duration calculator
    this.taskForm.get('isMilestone')?.valueChanges.subscribe(isMilestone => {
      if (isMilestone) {
        this.taskForm.get('duration')?.setValue(0);
        // Standard milestone starts & ends on same date
        const start = this.taskForm.get('startDate')?.value;
        if (start) {
          this.taskForm.get('endDate')?.setValue(start);
        }
      } else {
        this.onDateChange();
      }
    });
  }

  private patchFormValues(task: Task): void {
    const parseToLocalDate = (dateVal: any): Date | null => {
      if (!dateVal) return null;
      if (dateVal instanceof Date) return dateVal;
      const str = String(dateVal).trim();
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
      const d = new Date(str);
      if (isNaN(d.getTime())) return null;
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };

    this.taskForm.patchValue({
      name: task.name,
      description: task.description || '',
      parentId: task.parentId || null,
      startDate: parseToLocalDate(task.startDate),
      endDate: parseToLocalDate(task.endDate),
      duration: task.duration,
      progress: task.progress,
      priority: task.priority,
      status: task.status,
      isMilestone: task.isMilestone,
      resourceIds: task.resourceIds || [],
    });
  }

  private updateAvailableParents(taskList: Task[]): void {
    if (this.task) {
      const matchId = (this.task._id || this.task.id) as string;
      
      // Helper to recursively find all descendant IDs of a task
      const getDescendantIds = (targetId: string): Set<string> => {
        const descendants = new Set<string>();
        const findChildren = (pid: string) => {
          taskList.forEach(t => {
            const tId = (t._id || t.id) as string;
            const tParentId = t.parentId as string;
            if (tParentId && String(tParentId) === String(pid) && !descendants.has(tId)) {
              descendants.add(tId);
              findChildren(tId);
            }
          });
        };
        findChildren(targetId);
        return descendants;
      };

      const descendants = getDescendantIds(matchId);

      this.availableParentTasks = taskList.filter(t => {
        const tId = (t._id || t.id) as string;
        return tId !== matchId && !descendants.has(tId);
      });
    } else {
      this.availableParentTasks = taskList;
    }
  }

  private dateOrderValidator(group: FormGroup): { [key: string]: boolean } | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (start && end && new Date(end) < new Date(start)) {
      group.get('endDate')?.setErrors({ dateOrder: true });
      return { dateOrder: true };
    }
    return null;
  }

  public onDateChange(): void {
    const start = this.taskForm.get('startDate')?.value;
    const end = this.taskForm.get('endDate')?.value;
    const isMilestone = this.taskForm.get('isMilestone')?.value;

    if (isMilestone) {
      this.taskForm.get('duration')?.setValue(0);
      return;
    }

    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (e <= s) {
        this.taskForm.get('duration')?.setValue(0);
      } else {
        const diffTime = e.getTime() - s.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        this.taskForm.get('duration')?.setValue(diffDays);
      }
    }
  }

  public closeForm(): void {
    this.close.emit();
  }

  public submitForm(): void {
    if (this.taskForm.invalid) return;

    this.submitting = true;
    const activeProjectId = this.store.getSnapshot().selectedProjectId;

    if (!activeProjectId) {
      this.message.error('No project selected. Please create/select a project first.');
      this.submitting = false;
      return;
    }

    const formatDateOnly = (dateVal: any): string => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formRaw = this.taskForm.getRawValue();
    const taskPayload: Task = {
      projectId: activeProjectId,
      name: formRaw.name,
      description: formRaw.description,
      parentId: formRaw.parentId,
      startDate: formatDateOnly(formRaw.startDate),
      endDate: formatDateOnly(formRaw.endDate),
      duration: formRaw.duration || 1,
      progress: formRaw.progress,
      priority: formRaw.priority,
      status: formRaw.status,
      isMilestone: !!formRaw.isMilestone,
      resourceIds: formRaw.resourceIds || [],
    };

    if (taskPayload.startDate === taskPayload.endDate && !taskPayload.isMilestone) {
      this.message.warning('Same start and end date on a normal task is usually reserved for Milestones.');
    }

    if (this.task) {
      // Edit mode
      const matchId = (this.task._id || this.task.id) as string;
      this.taskApi.updateTask(matchId, taskPayload).subscribe({
        next: (updatedTask) => {
          this.message.success('Task updated successfully!');
          this.store.localUpdateTask(updatedTask);
          
          this.syncStoreTasks(activeProjectId);
          this.saved.emit();
          this.closeForm();
        },
        error: (err) => {
          this.message.error(err.message || 'Failed updating task');
          this.submitting = false;
        },
      });
    } else {
      // Create mode
      if (formRaw.depPredecessorId) {
        const predecessor = this.availableParentTasks.find(t => String(t._id || t.id) === String(formRaw.depPredecessorId));
        if (predecessor) {
          const newDates = calculateSuccessorDates(
            predecessor,
            taskPayload.duration || 1,
            formRaw.depType,
            Number(formRaw.depLag) || 0
          );
          taskPayload.startDate = newDates.startDate;
          taskPayload.endDate = newDates.endDate;
        }
      }

      this.taskApi.createTask(taskPayload).subscribe({
        next: (createdTask) => {
          this.store.localAddTask(createdTask);

          if (formRaw.depPredecessorId) {
            const dependencyObj = {
              projectId: activeProjectId,
              fromTaskId: formRaw.depPredecessorId,
              toTaskId: (createdTask._id || createdTask.id) as string,
              type: formRaw.depType,
              lag: Number(formRaw.depLag) || 0
            };

            this.taskApi.createDependency(dependencyObj).subscribe({
              next: (newDep) => {
                this.message.success('Task and dependency link created successfully!');
                this.store.localAddDependency(newDep);
                
                this.syncStoreTasksAndDependencies(activeProjectId);
                this.saved.emit();
                this.closeForm();
              },
              error: (err) => {
                this.message.error(err.error?.message || err.message || 'Task created, but failed to create dependency');
                this.syncStoreTasksAndDependencies(activeProjectId);
                this.saved.emit();
                this.closeForm();
              }
            });
          } else {
            this.message.success('Task created successfully!');
            this.syncStoreTasks(activeProjectId);
            this.saved.emit();
            this.closeForm();
          }
        },
        error: (err) => {
          this.message.error(err.message || 'Failed creating task');
          this.submitting = false;
        },
      });
    }
  }

  private syncStoreTasks(projectId: string): void {
    this.submitting = false;
    this.taskApi.getTasks(projectId).subscribe(taskList => {
      this.store.setTasks(taskList);
    });

    const pag = this.store.getSnapshot().pagination;
    this.taskApi.getPaginatedTasks(projectId, pag.page, pag.limit).subscribe(res => {
      this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
    });
  }

  private syncStoreTasksAndDependencies(projectId: string): void {
    this.submitting = false;
    this.taskApi.getTasks(projectId).subscribe(taskList => {
      this.store.setTasks(taskList);
    });

    const pag = this.store.getSnapshot().pagination;
    this.taskApi.getPaginatedTasks(projectId, pag.page, pag.limit).subscribe(res => {
      this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
    });

    this.taskApi.getDependencies(projectId).subscribe(deps => {
      this.store.setDependencies(deps);
    });
  }
}
