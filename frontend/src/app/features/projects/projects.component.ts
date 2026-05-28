import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskStore, Project } from '../../core/state/task-store.service';
import { ProjectApiService } from '../../core/services/project-api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzDatePickerModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <div class="projects-page-container">
      <div class="projects-header">
        <div class="title-block">
          <h1>Project Directory & Portfolio Hub</h1>
          <p class="subtitle">Create, monitor, and manage your enterprise project containers</p>
        </div>
        <button nz-button nzType="primary" nzSize="large" (click)="openCreateModal()">
          <span nz-icon nzType="plus"></span> Create Project
        </button>
      </div>

      <!-- Search & Sorting Controls -->
      <div class="search-controls">
        <input
          nz-input
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearchChange()"
          placeholder="Search projects by name..."
          class="project-search-input"
        />
        <nz-select [(ngModel)]="sortBy" (ngModelChange)="onSortChange()" style="width: 180px;">
          <nz-option nzValue="createdAt" nzLabel="Sort: Date Created"></nz-option>
          <nz-option nzValue="name" nzLabel="Sort: Project Name"></nz-option>
          <nz-option nzValue="startDate" nzLabel="Sort: Start Date"></nz-option>
        </nz-select>
      </div>

      <!-- Projects Grid Layout -->
      <div class="projects-grid" *ngIf="filteredProjectsList.length > 0">
        <div *ngFor="let proj of filteredProjectsList" class="project-card" [class.active-project-card]="selectedProjectId === (proj._id || proj.id)">
          <div class="card-glow"></div>
          
          <!-- Card Header Section -->
          <div class="card-header">
            <div class="icon-avatar">
              <span nz-icon nzType="project" class="avatar-svg"></span>
            </div>
            
            <div class="badge-block">
              <nz-tag [nzColor]="getStatusColor(proj.status)" class="status-tag">
                {{ proj.status | titlecase }}
              </nz-tag>
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="card-content">
            <h3 class="proj-title">{{ proj.name }}</h3>
            <p class="proj-desc" [title]="proj.description || ''">
              {{ proj.description || 'No description supplied for this project.' }}
            </p>

            <div class="dates-meta">
              <div class="meta-item">
                <span class="meta-label">Starts:</span>
                <span class="meta-val">{{ formatDate(proj.startDate) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Ends:</span>
                <span class="meta-val">{{ formatDate(proj.endDate) }}</span>
              </div>
            </div>
          </div>

          <!-- Card Footer Actions -->
          <div class="card-actions">
            <div class="left-action">
              <button 
                nz-button 
                nzType="link" 
                (click)="selectProject(proj)"
                [disabled]="selectedProjectId === (proj._id || proj.id)"
              >
                <span nz-icon nzType="check-circle" *ngIf="selectedProjectId === (proj._id || proj.id)"></span>
                {{ selectedProjectId === (proj._id || proj.id) ? 'Selected' : 'Select Project' }}
              </button>
            </div>
            
            <div class="right-actions">
              <button nz-button nzType="text" class="edit-btn" (click)="openEditModal(proj)">
                <span nz-icon nzType="edit"></span>
              </button>
              <button nz-button nzType="text" nzDanger class="delete-btn" (click)="deleteProject(proj)">
                <span nz-icon nzType="delete"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State for Empty DB -->
      <div *ngIf="projectsList.length === 0" class="empty-state">
        <span nz-icon nzType="folder-open" class="empty-icon"></span>
        <h2>No Projects Found</h2>
        <p>Boot up your workspace by creating your first project container container now!</p>
        <button nz-button nzType="primary" (click)="openCreateModal()" style="margin-top: 16px;">
          <span nz-icon nzType="plus"></span> Add Project
        </button>
      </div>

      <!-- Empty State for Search bounds -->
      <div *ngIf="projectsList.length > 0 && filteredProjectsList.length === 0" class="empty-state">
        <span nz-icon nzType="info-circle" class="empty-icon"></span>
        <h2>No Matching Projects Found</h2>
        <p>Try refining your search keyword or sorting filter to locate the project container.</p>
      </div>
    </div>

    <!-- Project Edit / Create Modal Form dialog -->
    <nz-modal
      [(nzVisible)]="isModalVisible"
      [nzTitle]="editingProject ? 'Modify Project: ' + editingProject.name : 'Bootstrap New Project'"
      (nzOnCancel)="handleCancel()"
      (nzOnOk)="handleOk()"
      [nzOkLoading]="isSubmitting"
      [nzOkDisabled]="projectForm.invalid"
    >
      <form nz-form [formGroup]="projectForm" *nzModalContent class="modal-form-content">
        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzRequired nzFor="name">Project Name</nz-form-label>
          <nz-form-control [nzSpan]="16" nzErrorTip="Please enter the project name!">
            <input nz-input formControlName="name" id="name" placeholder="e.g. Q3 Bryntum Integration" />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzFor="description">Description</nz-form-label>
          <nz-form-control [nzSpan]="16">
            <textarea
              nz-input
              formControlName="description"
              id="description"
              placeholder="Supply summary details of this project scope..."
              rows="3"
            ></textarea>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzRequired nzFor="startDate">Start Date</nz-form-label>
          <nz-form-control [nzSpan]="16" nzErrorTip="Please select a start date!">
            <nz-date-picker formControlName="startDate" class="date-picker"></nz-date-picker>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzSpan]="6" nzRequired nzFor="endDate">End Date</nz-form-label>
          <nz-form-control [nzSpan]="16" [nzErrorTip]="endDateErrorTip">
            <nz-date-picker formControlName="endDate" class="date-picker"></nz-date-picker>
            <ng-template #endDateErrorTip let-control>
              <ng-container *ngIf="control.hasError('required')">Please select an end date!</ng-container>
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
      .projects-page-container {
        padding: 24px;
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        min-height: calc(100vh - 160px);
      }

      .projects-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
        flex-wrap: wrap;
        gap: 16px;

        h1 {
          font-size: 22px;
          margin: 0;
          font-weight: 700;
          color: var(--text-primary);
        }

        .subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
      }

      .projects-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
        gap: 20px;
        margin-top: 10px;
      }

      .project-card {
        background: #ffffff;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, border-color 0.25s ease;

        &:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--primary-color);
        }

        &.active-project-card {
          border-color: var(--primary-color);
          background: linear-gradient(180deg, #ffffff 0%, #f0f7ff 100%);
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.08);

          .icon-avatar {
            background: #dbeafe !important;
            color: var(--primary-color) !important;
          }
        }
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        .icon-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: #f1f5f9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
      }

      .card-content {
        flex-grow: 1;

        .proj-title {
          margin: 0 0 8px 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .proj-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0 0 16px 0;
          height: 38px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }

      .dates-meta {
        background: #f8fafc;
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        margin-bottom: 16px;

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meta-label {
          color: var(--text-secondary);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.5px;
        }

        .meta-val {
          color: var(--text-primary);
          font-weight: 600;
        }
      }

      .card-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #f1f5f9;
        padding-top: 12px;
        margin-top: 8px;

        .left-action {
          button {
            padding: 0;
            font-size: 11px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }
        }

        .right-actions {
          display: flex;
          gap: 4px;

          button {
            width: 28px;
            height: 28px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-size: 13px;

            &.edit-btn:hover {
              background: #f1f5f9;
              color: var(--text-primary);
            }
          }
        }
      }

      .empty-state {
        text-align: center;
        padding: 60px 40px;
        border: 1px dashed var(--border-color);
        border-radius: var(--radius-md);
        margin-top: 20px;

        .empty-icon {
          font-size: 40px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        h2 {
          font-size: 16px;
          margin: 0 0 6px 0;
          font-weight: 600;
        }

        p {
          font-size: 12.5px;
          color: var(--text-secondary);
          max-width: 320px;
          margin: 0 auto;
        }
      }

      .search-controls {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 24px;
        
        .project-search-input {
          width: 100%;
          max-width: 320px;
        }
      }

      .date-picker {
        width: 100%;
      }
    `,
  ],
})
export class ProjectsComponent implements OnInit, OnDestroy {
  public projectsList: Project[] = [];
  public filteredProjectsList: Project[] = [];
  public selectedProjectId: string | null = null;
  public searchQuery = '';
  public sortBy = 'createdAt';

  // Modal Controls
  public isModalVisible = false;
  public isSubmitting = false;
  public editingProject: Project | null = null;
  public projectForm!: FormGroup;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private store: TaskStore,
    private projectApi: ProjectApiService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Sync full list of projects from the store
    this.store.projects$.pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.projectsList = list;
      this.applyFilter();
      this.cdr.markForCheck();
    });

    // Listen to selected projectId
    this.store.selectedProjectId$.pipe(takeUntil(this.destroy$)).subscribe(id => {
      this.selectedProjectId = id;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public applyFilter(): void {
    let filtered = [...this.projectsList];
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (this.sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (this.sortBy === 'startDate') {
        const dA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dA - dB;
      } else {
        // createdAt
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cB - cA; // newest first
      }
    });

    this.filteredProjectsList = filtered;
  }

  public onSearchChange(): void {
    this.applyFilter();
    this.cdr.markForCheck();
  }

  public onSortChange(): void {
    this.applyFilter();
    this.cdr.markForCheck();
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

  private dateOrderValidator(group: FormGroup): { [key: string]: boolean } | null {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (start && end && new Date(end) < new Date(start)) {
      group.get('endDate')?.setErrors({ dateOrder: true });
      return { dateOrder: true };
    }
    return null;
  }

  public selectProject(project: Project): void {
    const id = (project._id || project.id) as string;
    this.store.setSelectedProject(id);
    this.message.info(`Workspace switched to project: "${project.name}"`);
    this.router.navigate(['/gantt'], { queryParams: { projectId: id } });
  }

  public openCreateModal(): void {
    this.editingProject = null;
    this.projectForm.reset({ status: 'planning' });
    this.isModalVisible = true;
  }

  public openEditModal(project: Project): void {
    this.editingProject = project;
    
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

    this.projectForm.patchValue({
      name: project.name,
      description: project.description || '',
      startDate: parseToLocalDate(project.startDate),
      endDate: parseToLocalDate(project.endDate),
      status: project.status,
    });
    this.isModalVisible = true;
  }

  public handleCancel(): void {
    this.isModalVisible = false;
    this.editingProject = null;
  }

  public handleOk(): void {
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

    if (this.editingProject) {
      // Update Mode
      const projId = (this.editingProject._id || this.editingProject.id) as string;
      this.projectApi.updateProject(projId, formVal).subscribe({
        next: (updatedProj) => {
          this.message.success('Project details modified successfully.');
          this.refreshStoreProjects(projId);
          this.isModalVisible = false;
          this.isSubmitting = false;
          this.editingProject = null;
        },
        error: (err) => {
          this.message.error(err.message || 'Error modifying project');
          this.isSubmitting = false;
        },
      });
    } else {
      // Create Mode
      this.projectApi.createProject(formVal).subscribe({
        next: (newProj) => {
          this.message.success('New project bootstrap completed successfully!');
          const newId = (newProj._id || newProj.id) as string;
          this.refreshStoreProjects(newId);
          this.isModalVisible = false;
          this.isSubmitting = false;
        },
        error: (err) => {
          this.message.error(err.message || 'Error bootstraping project');
          this.isSubmitting = false;
        },
      });
    }
  }

  public deleteProject(project: Project): void {
    const projId = (project._id || project.id) as string;
    const confirmed = confirm(`Are you sure you want to delete project "${project.name}"?\nWARNING: This will permanently delete all associated tasks, scheduler records, and dependency links!`);
    
    if (confirmed) {
      this.projectApi.deleteProject(projId).subscribe({
        next: () => {
          this.message.success('Project and associated records deleted.');
          
          // Re-sync projects in store
          this.projectApi.getProjects().subscribe(list => {
            this.store.setProjects(list);
            
            // If the deleted project was selected, shift selection
            if (this.selectedProjectId === projId) {
              if (list.length > 0) {
                const nextId = (list[0]._id || list[0].id) as string;
                this.store.setSelectedProject(nextId);
              } else {
                this.store.setSelectedProject(null);
              }
            }
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          this.message.error(err.message || 'Error deleting project');
        },
      });
    }
  }

  private refreshStoreProjects(selectId: string): void {
    this.projectApi.getProjects().subscribe(list => {
      this.store.setProjects(list);
      this.store.setSelectedProject(selectId);
      this.cdr.markForCheck();
    });
  }

  // Formatting Helpers
  public formatDate(dateVal: any): string {
    if (!dateVal) return '-';
    return new Date(dateVal).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  public getStatusColor(status: string): string {
    switch (status) {
      case 'planning':
        return 'blue';
      case 'active':
        return 'green';
      case 'on_hold':
        return 'orange';
      case 'completed':
        return 'magenta';
      default:
        return 'default';
    }
  }
}
