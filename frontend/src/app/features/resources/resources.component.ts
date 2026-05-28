import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { NzMessageService } from 'ng-zorro-antd/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskStore, Resource } from '../../core/state/task-store.service';
import { ResourceApiService } from '../../core/services/resource-api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-resources',
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
    PageHeaderComponent,
  ],
  template: `
    <app-page-header title="Resource Management"></app-page-header>

    <div nz-row [nzGutter]="24">
      <!-- Create Resource Panel (Left) -->
      <div nz-col [nzXs]="24" [nzLg]="8">
        <div class="enterprise-card sticky-panel">
          <h3 class="panel-title">Add New Resource</h3>
          <p class="panel-subtitle">Create enterprise project resources to assign to Gantt schedule tasks.</p>
          
          <form nz-form [formGroup]="resourceForm" (ngSubmit)="onSubmit()" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="name">Full Name</nz-form-label>
              <nz-form-control nzErrorTip="Please enter full name!">
                <input nz-input formControlName="name" id="name" placeholder="John Doe" />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="role">Role / Job Title</nz-form-label>
              <nz-form-control nzErrorTip="Please enter job role!">
                <input nz-input formControlName="role" id="role" placeholder="Senior Developer" />
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="email">Email Address</nz-form-label>
              <nz-form-control [nzErrorTip]="emailErrorTip">
                <input nz-input type="email" formControlName="email" id="email" placeholder="john.doe&#64;company.com" />
                <ng-template #emailErrorTip let-control>
                  <ng-container *ngIf="control.hasError('required')">Please enter email!</ng-container>
                  <ng-container *ngIf="control.hasError('email')">Please enter a valid email address!</ng-container>
                </ng-template>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired nzFor="availability">Availability (%)</nz-form-label>
              <nz-form-control nzErrorTip="Availability must be between 0 and 100%">
                <nz-input-number
                  formControlName="availability"
                  id="availability"
                  [nzMin]="0"
                  [nzMax]="100"
                  [nzStep]="10"
                  class="full-width"
                ></nz-input-number>
              </nz-form-control>
            </nz-form-item>

            <button nz-button nzType="primary" type="submit" [nzLoading]="submitting" [disabled]="resourceForm.invalid" class="full-width">
              <span nz-icon nzType="plus"></span> Add Resource
            </button>
          </form>
        </div>
      </div>

      <!-- Resource List Panel (Right) -->
      <div nz-col [nzXs]="24" [nzLg]="16">
        <div class="resource-list-container">
          <div *ngIf="resources.length === 0" class="empty-state">
            <span nz-icon nzType="team" class="empty-icon"></span>
            <h3>No Resources Found</h3>
            <p>Please register project resources on the left panel to assign them to project schedule tasks.</p>
          </div>

          <div nz-row [nzGutter]="16" *ngIf="resources.length > 0">
            <div nz-col [nzXs]="24" [nzSm]="12" [nzMd]="12" *ngFor="let res of resources" style="margin-bottom: 16px;">
              <div class="resource-card">
                <div class="card-header">
                  <div class="avatar">
                    {{ getInitials(res.name) }}
                  </div>
                  <div class="info">
                    <h4>{{ res.name }}</h4>
                    <p class="role">{{ res.role }}</p>
                  </div>
                </div>

                <div class="card-body">
                  <div class="meta-row">
                    <span nz-icon nzType="mail" class="meta-icon"></span>
                    <span class="meta-text">{{ res.email }}</span>
                  </div>

                  <div class="meta-row" style="margin-top: 8px;">
                    <span nz-icon nzType="dashboard" class="meta-icon"></span>
                    <span class="meta-text">Availability: 
                      <nz-tag [nzColor]="getAvailabilityColor(res.availability)">
                        {{ res.availability }}%
                      </nz-tag>
                    </span>
                  </div>
                </div>

                <div class="card-actions">
                  <button
                    nz-button
                    nzType="text"
                    nzDanger
                    nz-popconfirm
                    nzPopconfirmTitle="Are you sure you want to delete this resource? It will be removed from all assigned tasks."
                    nzPopconfirmPlacement="topRight"
                    (nzOnConfirm)="deleteResource((res._id || res.id)!)"
                  >
                    <span nz-icon nzType="delete"></span> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .sticky-panel {
        position: sticky;
        top: 20px;
      }

      .panel-title {
        font-size: 16px;
        margin-bottom: 4px;
        font-weight: 700;
      }

      .panel-subtitle {
        color: var(--text-secondary);
        font-size: 12px;
        margin-bottom: 20px;
      }

      .full-width {
        width: 100%;
      }

      .resource-list-container {
        min-height: 400px;
      }

      .empty-state {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 60px 40px;
        text-align: center;
        box-shadow: var(--shadow-sm);
        
        .empty-icon {
          font-size: 48px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        h3 {
          font-size: 16px;
          margin-bottom: 8px;
        }

        p {
          color: var(--text-secondary);
          max-width: 380px;
          margin: 0 auto;
          font-size: 13px;
        }
      }

      /* Premium Resource Card Styling */
      .resource-card {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        transition: all 0.2s ease;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 180px;

        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;

          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--primary-light);
            color: var(--primary-color);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
            border: 1px solid #c3dafe;
          }

          .info {
            h4 {
              margin: 0;
              font-size: 14px;
              font-weight: 600;
              color: var(--text-primary);
            }
            .role {
              margin: 2px 0 0 0;
              font-size: 11px;
              color: var(--text-secondary);
              font-weight: 500;
            }
          }
        }

        .card-body {
          margin-top: 14px;
          flex-grow: 1;

          .meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--text-secondary);

            .meta-icon {
              font-size: 13px;
              color: #94a3b8;
            }
            
            .meta-text {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        }

        .card-actions {
          border-top: 1px solid var(--border-color);
          padding-top: 8px;
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          
          button {
            height: 28px;
            padding: 0 8px;
            font-size: 12px;
            font-weight: 500;
          }
        }
      }
    `,
  ],
})
export class ResourcesComponent implements OnInit, OnDestroy {
  public resourceForm!: FormGroup;
  public resources: Resource[] = [];
  public submitting: boolean = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private store: TaskStore,
    private resourceApi: ResourceApiService,
    private message: NzMessageService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    // Listen to resources state
    this.store.resources$.pipe(takeUntil(this.destroy$)).subscribe(resList => {
      this.resources = resList;
    });

    // Initial fetch of resources from backend if empty in store
    this.fetchResources();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.resourceForm = this.fb.group({
      name: ['', [Validators.required]],
      role: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      availability: [100, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  private fetchResources(): void {
    this.resourceApi.getResources().subscribe({
      next: (resList) => {
        this.store.setResources(resList);
      },
      error: (err) => {
        console.error('Failed loading resources:', err);
      }
    });
  }

  public onSubmit(): void {
    if (this.resourceForm.invalid) return;

    this.submitting = true;
    const resourcePayload: Resource = this.resourceForm.value;

    this.resourceApi.createResource(resourcePayload).subscribe({
      next: (res) => {
        this.message.success('Resource created successfully!');
        this.store.localAddResource(res);
        this.resourceForm.reset({ availability: 100 });
        this.submitting = false;
      },
      error: (err) => {
        this.message.error(err.message || 'Failed to register resource');
        this.submitting = false;
      },
    });
  }

  public deleteResource(id: string): void {
    this.resourceApi.deleteResource(id).subscribe({
      next: () => {
        this.message.success('Resource deleted successfully!');
        // Refresh resources list
        this.fetchResources();
        
        // Also refresh tasks of project to update their resources tags
        const activeProjectId = this.store.getSnapshot().selectedProjectId;
        if (activeProjectId) {
          this.store.setLoading(true);
          this.resourceApi.getResources().subscribe(res => {
            this.store.setResources(res);
          });
        }
      },
      error: (err) => {
        this.message.error(err.message || 'Failed deleting resource');
      },
    });
  }

  // UI Helpers
  public getInitials(name: string): string {
    if (!name) return 'R';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  public getAvailabilityColor(av: number): string {
    if (av >= 80) return 'green';
    if (av >= 50) return 'orange';
    return 'red';
  }
}
