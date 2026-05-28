import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TaskStore, Project } from '../../../core/state/task-store.service';
import { ProjectApiService } from '../../../core/services/project-api.service';
import { TaskApiService } from '../../../core/services/task-api.service';
import { Subject } from 'rxjs';
import { takeUntil, delay } from 'rxjs/operators';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzSelectModule,
    NzButtonModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzDatePickerModule,
    NzIconModule,
  ],
  template: `
    <div class="header-container">
      <div class="title-section">
        <h1>{{ title }}</h1>
        <p class="subtitle" *ngIf="selectedProject">Active: {{ selectedProject.name }}</p>
      </div>

      <div class="action-section">
        <!-- Project Selector -->
        <nz-select
          [ngModel]="selectedProjectId"
          (ngModelChange)="onProjectChange($event)"
          nzPlaceHolder="Select Project"
          class="project-select"
          [nzLoading]="loading"
        >
          <nz-option
            *ngFor="let proj of projects"
            [nzValue]="proj._id || proj.id"
            [nzLabel]="proj.name"
          ></nz-option>
        </nz-select>

        <!-- Create Project Button -->
        <button nz-button nzType="primary" (click)="openCreateProjectModal()">
          <span nz-icon nzType="plus"></span> New Project
        </button>
      </div>
    </div>

    <!-- Create Project Modal -->
    <nz-modal
      [(nzVisible)]="isModalVisible"
      nzTitle="Create New Project"
      (nzOnCancel)="handleCancel()"
      (nzOnOk)="handleCreateProject()"
      [nzOkLoading]="isSubmitting"
      [nzOkDisabled]="projectForm.invalid"
    >
      <form nz-form [formGroup]="projectForm" *nzModalContent>
        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzRequired nzFor="name">Project Name</nz-form-label>
          <nz-form-control [nzSpan]="16" nzErrorTip="Please input the project name!">
            <input nz-input formControlName="name" id="name" placeholder="Enter project name" />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzFor="description">Description</nz-form-label>
          <nz-form-control [nzSpan]="16">
            <textarea
              nz-input
              formControlName="description"
              id="description"
              placeholder="Enter project description"
            ></textarea>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzRequired nzFor="startDate">Start Date</nz-form-label>
          <nz-form-control [nzSpan]="16" nzErrorTip="Please select project start date!">
            <nz-date-picker formControlName="startDate" class="date-picker"></nz-date-picker>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzRequired nzFor="endDate">End Date</nz-form-label>
          <nz-form-control [nzSpan]="16" [nzErrorTip]="endDateErrorTip">
            <nz-date-picker formControlName="endDate" class="date-picker"></nz-date-picker>
            <ng-template #endDateErrorTip let-control>
              <ng-container *ngIf="control.hasError('required')">Please select project end date!</ng-container>
              <ng-container *ngIf="control.hasError('dateOrder')">End date cannot be before start date!</ng-container>
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzFor="status">Status</nz-form-label>
          <nz-form-control [nzSpan]="16">
            <nz-select formControlName="status" id="status">
              <nz-option nzValue="planning" nzLabel="Planning"></nz-option>
              <nz-option nzValue="active" nzLabel="Active"></nz-option>
              <nz-option nzValue="on_hold" nzLabel="On Hold"></nz-option>
              <nz-option nzValue="completed" nzLabel="Completed"></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>
      </form>
    </nz-modal>
  `,
  styles: [
    `
      .header-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: var(--panel-bg);
        border-bottom: 1px solid var(--border-color);
        box-shadow: var(--shadow-sm);
        margin-bottom: 20px;
        border-radius: var(--radius-md);
      }

      .title-section {
        h1 {
          font-size: 20px;
          margin: 0;
          font-weight: 700;
          color: var(--text-primary);
        }
        .subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin: 4px 0 0 0;
          font-weight: 500;
        }
      }

      .action-section {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .project-select {
        width: 220px;
      }

      .date-picker {
        width: 100%;
      }
    `,
  ],
})
export class PageHeaderComponent implements OnInit, OnDestroy {
  @Input() title: string = '';

  public projects: Project[] = [];
  public selectedProjectId: string | null = null;
  public selectedProject: Project | null = null;
  public loading: boolean = false;
  
  // Create Project Modal controls
  public isModalVisible = false;
  public isSubmitting = false;
  public projectForm!: FormGroup;

  private destroy$ = new Subject<void>();

  constructor(
    private store: TaskStore,
    private projectApi: ProjectApiService,
    private taskApi: TaskApiService,
    private fb: FormBuilder,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Listen to projects state
    this.store.projects$.pipe(
      delay(0),
      takeUntil(this.destroy$)
    ).subscribe(projList => {
      this.projects = projList;
      this.cdr.markForCheck();
    });

    // Listen to selected project state
    this.store.selectedProjectId$.pipe(
      delay(0),
      takeUntil(this.destroy$)
    ).subscribe(id => {
      this.selectedProjectId = id;
      this.cdr.markForCheck();
    });

    this.store.selectedProject$.pipe(
      delay(0),
      takeUntil(this.destroy$)
    ).subscribe(proj => {
      this.selectedProject = proj;
      this.cdr.markForCheck();
    });

    this.store.loading$.pipe(
      delay(0),
      takeUntil(this.destroy$)
    ).subscribe(loading => {
      this.loading = loading;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.projectForm = this.fb.group(
      {
        name: ['', [Validators.required]],
        description: [''],
        startDate: [null, [Validators.required]],
        endDate: [null, [Validators.required]],
        status: ['planning'],
      },
      { validators: this.dateOrderValidator }
    );
  }

  // Check end date is after start date
  private dateOrderValidator(group: FormGroup): { [key: string]: boolean } | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (start && end && new Date(end) < new Date(start)) {
      group.get('endDate')?.setErrors({ dateOrder: true });
      return { dateOrder: true };
    }
    return null;
  }

  // Trigger project change in RxJS state store
  public onProjectChange(projectId: string): void {
    this.store.setLoading(true);
    this.store.setSelectedProject(projectId);
    
    // Fetch and sync tasks of the newly selected project
    this.taskApi.getTasks(projectId).subscribe({
      next: (taskList) => {
        this.store.setTasks(taskList);
        
        // Also fetch paginated tasks for AG Grid
        this.taskApi.getPaginatedTasks(projectId, 1, 50).subscribe({
          next: (res) => {
            this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
            this.store.setLoading(false);
          },
          error: (err) => {
            this.store.setError(err.message || 'Failed loading tasks page');
            this.store.setLoading(false);
          }
        });
      },
      error: (err) => {
        this.store.setError(err.message || 'Failed loading tasks');
        this.store.setLoading(false);
      }
    });

    // Fetch and sync dependencies of project
    this.taskApi.getDependencies(projectId).subscribe({
      next: (depList) => {
        this.store.setDependencies(depList);
      },
      error: (err) => {
        console.error('Failed loading dependencies:', err);
      }
    });
  }

  // Project modal open/close
  public openCreateProjectModal(): void {
    this.projectForm.reset({ status: 'planning' });
    this.isModalVisible = true;
  }

  public handleCancel(): void {
    this.isModalVisible = false;
  }

  public handleCreateProject(): void {
    if (this.projectForm.invalid) return;

    this.isSubmitting = true;

    const formatDateOnly = (dateVal: any): string => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formRaw = this.projectForm.value;
    const formVal = {
      ...formRaw,
      startDate: formatDateOnly(formRaw.startDate),
      endDate: formatDateOnly(formRaw.endDate),
    };

    this.projectApi.createProject(formVal).subscribe({
      next: (newProj) => {
        this.message.success('Project created successfully!');
        
        // Refresh all projects and select the newly created one!
        this.projectApi.getProjects().subscribe((projList) => {
          this.store.setProjects(projList);
          const newId = (newProj._id || newProj.id) as string;
          this.store.setSelectedProject(newId);
          this.onProjectChange(newId);
        });

        this.isSubmitting = false;
        this.isModalVisible = false;
      },
      error: (err) => {
        this.message.error(err.message || 'Failed to create project');
        this.isSubmitting = false;
      },
    });
  }
}
