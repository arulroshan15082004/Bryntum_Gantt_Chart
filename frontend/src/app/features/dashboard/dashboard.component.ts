import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskStore, Project, Task, Resource } from '../../core/state/task-store.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NzGridModule,
    NzCardModule,
    NzStatisticModule,
    NzProgressModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header title="Project Dashboard"></app-page-header>

    <div class="dashboard-content">
      <nz-spin [nzSpinning]="loading" [nzTip]="'Analyzing Project Metrics...'">
        <div *ngIf="!selectedProjectId" class="empty-dashboard">
          <span nz-icon nzType="project" class="empty-icon"></span>
          <h2>Welcome to Gantt Project Manager</h2>
          <p>Please select an existing project from the header or create a new project to start managing tasks.</p>
        </div>

        <div *ngIf="selectedProjectId" class="metrics-grid">
          <!-- KPI Row -->
          <div nz-row [nzGutter]="16">
            <!-- Total Projects Card -->
            <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8">
              <div class="kpi-card text-blue">
                <div class="kpi-icon">
                  <span nz-icon nzType="project"></span>
                </div>
                <div class="kpi-value">
                  <h3>{{ totalProjects }}</h3>
                  <p>Total Projects Managed</p>
                </div>
              </div>
            </div>

            <!-- Total Tasks Card -->
            <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8">
              <div class="kpi-card text-slate">
                <div class="kpi-icon">
                  <span nz-icon nzType="unordered-list"></span>
                </div>
                <div class="kpi-value">
                  <h3>{{ totalTasks }}</h3>
                  <p>Total Project Tasks</p>
                </div>
              </div>
            </div>

            <!-- Resources Assigned Card -->
            <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8">
              <div class="kpi-card text-indigo">
                <div class="kpi-icon">
                  <span nz-icon nzType="team"></span>
                </div>
                <div class="kpi-value">
                  <h3>{{ totalResources }}</h3>
                  <p>Available Resources</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Status KPI Row -->
          <div nz-row [nzGutter]="16" style="margin-top: 16px;">
            <!-- Completed Tasks Card -->
            <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8">
              <div class="kpi-card text-emerald">
                <div class="kpi-icon">
                  <span nz-icon nzType="check-circle"></span>
                </div>
                <div class="kpi-value">
                  <h3>{{ completedTasks }}</h3>
                  <p>Completed Tasks</p>
                </div>
              </div>
            </div>

            <!-- Pending Tasks Card -->
            <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8">
              <div class="kpi-card text-amber">
                <div class="kpi-icon">
                  <span nz-icon nzType="clock-circle"></span>
                </div>
                <div class="kpi-value">
                  <h3>{{ pendingTasks }}</h3>
                  <p>Pending Tasks</p>
                </div>
              </div>
            </div>

            <!-- Milestones Card -->
            <div nz-col [nzXs]="24" [nzSm]="12" [nzLg]="8">
              <div class="kpi-card text-rose">
                <div class="kpi-icon">
                  <span nz-icon nzType="trophy"></span>
                </div>
                <div class="kpi-value">
                  <h3>{{ milestoneTasks }}</h3>
                  <p>Key Project Milestones</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Progress Charts & Status Analytics -->
          <div nz-row [nzGutter]="16" style="margin-top: 24px;">
            <!-- Overall Progress Card -->
            <div nz-col [nzXs]="24" [nzLg]="12">
              <div class="enterprise-card progress-panel">
                <h4>Overall Project Progress</h4>
                <div class="progress-details">
                  <nz-progress
                    [nzPercent]="projectProgress"
                    nzType="circle"
                    [nzWidth]="160"
                    [nzStrokeColor]="'#0056b3'"
                  ></nz-progress>
                  <div class="progress-stats">
                    <div class="progress-stat-item">
                      <span class="dot done-dot"></span>
                      <div>
                        <h5>{{ projectProgress }}% Done</h5>
                        <p>Aggregated percent complete based on all child tasks.</p>
                      </div>
                    </div>
                    <div class="progress-stat-item" style="margin-top: 12px;">
                      <span class="dot pending-dot"></span>
                      <div>
                        <h5>{{ 100 - projectProgress }}% Remaining</h5>
                        <p>Pending schedule and work milestones.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Task Status Distribution Card -->
            <div nz-col [nzXs]="24" [nzLg]="12">
              <div class="enterprise-card distribution-panel">
                <h4>Task Status Distribution</h4>
                <div class="distribution-list">
                  <!-- Todo Status -->
                  <div class="dist-item">
                    <div class="dist-header">
                      <span>Todo Status</span>
                      <span>{{ todoTasks }} / {{ totalTasks }} Tasks ({{ getPercent(todoTasks) }}%)</span>
                    </div>
                    <nz-progress [nzPercent]="getPercent(todoTasks)" nzStatus="normal" [nzShowInfo]="false"></nz-progress>
                  </div>

                  <!-- In Progress Status -->
                  <div class="dist-item">
                    <div class="dist-header">
                      <span>In Progress</span>
                      <span>{{ inProgressTasks }} / {{ totalTasks }} Tasks ({{ getPercent(inProgressTasks) }}%)</span>
                    </div>
                    <nz-progress
                      [nzPercent]="getPercent(inProgressTasks)"
                      [nzStrokeColor]="'#f59e0b'"
                      [nzShowInfo]="false"
                    ></nz-progress>
                  </div>

                  <!-- Completed Status -->
                  <div class="dist-item">
                    <div class="dist-header">
                      <span>Completed Status</span>
                      <span>{{ completedTasks }} / {{ totalTasks }} Tasks ({{ getPercent(completedTasks) }}%)</span>
                    </div>
                    <nz-progress
                      [nzPercent]="getPercent(completedTasks)"
                      [nzStrokeColor]="'#10b981'"
                      [nzShowInfo]="false"
                    ></nz-progress>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nz-spin>
    </div>
  `,
  styles: [
    `
      .dashboard-content {
        padding: 0 4px;
      }

      .empty-dashboard {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 60px 40px;
        text-align: center;
        box-shadow: var(--shadow-sm);
        margin: 20px 0;
        
        .empty-icon {
          font-size: 56px;
          color: var(--primary-color);
          margin-bottom: 20px;
        }

        h2 {
          font-size: 22px;
          margin-bottom: 12px;
        }

        p {
          color: var(--text-secondary);
          max-width: 480px;
          margin: 0 auto;
          font-size: 14px;
        }
      }

      .kpi-card {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: var(--shadow-md);
        transition: all 0.2s ease;
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 30%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .kpi-value {
          h3 {
            font-size: 24px;
            margin: 0;
            line-height: 1;
            font-weight: 700;
          }
          p {
            margin: 4px 0 0 0;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 500;
          }
        }
      }

      /* Curated Harmony KPI Colors */
      .text-blue {
        border-left: 4px solid #0056b3;
        .kpi-icon { background: #eef5fc; color: #0056b3; }
      }
      .text-slate {
        border-left: 4px solid #64748b;
        .kpi-icon { background: #f1f5f9; color: #64748b; }
      }
      .text-indigo {
        border-left: 4px solid #4f46e5;
        .kpi-icon { background: #e0e7ff; color: #4f46e5; }
      }
      .text-emerald {
        border-left: 4px solid #10b981;
        .kpi-icon { background: #d1fae5; color: #10b981; }
      }
      .text-amber {
        border-left: 4px solid #f59e0b;
        .kpi-icon { background: #fef3c7; color: #f59e0b; }
      }
      .text-rose {
        border-left: 4px solid #f43f5e;
        .kpi-icon { background: #ffe4e6; color: #f43f5e; }
      }

      .progress-panel {
        padding: 24px;
        
        h4 {
          font-size: 16px;
          margin-bottom: 24px;
        }

        .progress-details {
          display: flex;
          align-items: center;
          justify-content: space-around;
          flex-wrap: wrap;
          gap: 24px;
        }

        .progress-stats {
          flex: 1;
          min-width: 200px;
        }

        .progress-stat-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-top: 6px;
          }
          .done-dot { background: var(--primary-color); }
          .pending-dot { background: #cbd5e1; }

          h5 {
            font-size: 14px;
            margin: 0;
          }
          p {
            color: var(--text-secondary);
            font-size: 11px;
            margin: 2px 0 0 0;
          }
        }
      }

      .distribution-panel {
        padding: 24px;
        
        h4 {
          font-size: 16px;
          margin-bottom: 24px;
        }

        .distribution-list {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .dist-item {
          .dist-header {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 6px;
          }
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  public selectedProjectId: string | null = null;
  public loading = false;

  // KPIs
  public totalProjects = 0;
  public totalTasks = 0;
  public totalResources = 0;
  
  public completedTasks = 0;
  public pendingTasks = 0;
  public milestoneTasks = 0;
  
  public todoTasks = 0;
  public inProgressTasks = 0;
  public projectProgress = 0;

  private destroy$ = new Subject<void>();

  constructor(private store: TaskStore) {}

  ngOnInit(): void {
    // Listen to selected project
    this.store.selectedProjectId$.pipe(takeUntil(this.destroy$)).subscribe(id => {
      this.selectedProjectId = id;
    });

    // Listen to loading states
    this.store.loading$.pipe(takeUntil(this.destroy$)).subscribe(loading => {
      this.loading = loading;
    });

    // Listen to global lists to compute analytics
    this.store.projects$.pipe(takeUntil(this.destroy$)).subscribe(projs => {
      this.totalProjects = projs.length;
    });

    this.store.resources$.pipe(takeUntil(this.destroy$)).subscribe(res => {
      this.totalResources = res.length;
    });

    // Compute task KPIs
    this.store.tasks$.pipe(takeUntil(this.destroy$)).subscribe(taskList => {
      this.computeMetrics(taskList);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private computeMetrics(taskList: Task[]): void {
    this.totalTasks = taskList.length;

    if (this.totalTasks === 0) {
      this.completedTasks = 0;
      this.pendingTasks = 0;
      this.milestoneTasks = 0;
      this.todoTasks = 0;
      this.inProgressTasks = 0;
      this.projectProgress = 0;
      return;
    }

    this.completedTasks = taskList.filter(t => t.status === 'done').length;
    this.pendingTasks = taskList.filter(t => t.status !== 'done').length;
    this.todoTasks = taskList.filter(t => t.status === 'todo').length;
    this.inProgressTasks = taskList.filter(t => t.status === 'in_progress').length;
    this.milestoneTasks = taskList.filter(t => t.isMilestone).length;

    // Calculate aggregated overall progress complete
    // Progress calculation based on flat duration weights or average percentage
    const progressSum = taskList.reduce((acc, t) => acc + (t.progress || 0), 0);
    this.projectProgress = Math.round(progressSum / this.totalTasks);
  }

  public getPercent(count: number): number {
    if (this.totalTasks === 0) return 0;
    return Math.round((count / this.totalTasks) * 100);
  }
}
