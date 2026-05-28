import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { TaskStore, Task } from '../../core/state/task-store.service';
import { TaskApiService } from '../../core/services/task-api.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-recently-deleted-tasks',
  standalone: true,
  imports: [
    CommonModule,
    NzTableModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzTagModule,
    PageHeaderComponent
  ],
  template: `
    <app-page-header title="Recently Deleted Tasks"></app-page-header>

    <div class="recently-deleted-container">
      <div *ngIf="!selectedProjectId" class="empty-layout">
        <span nz-icon nzType="project" class="empty-icon"></span>
        <h3>Please select a project to view its recently deleted tasks.</h3>
      </div>

      <div *ngIf="selectedProjectId" class="enterprise-card">
        <div class="card-header-bar">
          <div>
            <h3 class="panel-title">Deleted Tasks Queue</h3>
            <p class="panel-subtitle">Tasks deleted in this project can be restored within this session.</p>
          </div>
          <button
            nz-button
            nzType="default"
            (click)="fetchDeletedTasks()"
            [nzLoading]="loading"
          >
            <span nz-icon nzType="sync"></span>
            Refresh
          </button>
        </div>

        <nz-table
          #deletedTable
          [nzData]="deletedTasks"
          [nzLoading]="loading"
          nzSize="middle"
          [nzPageSize]="10"
          class="enterprise-table"
        >
          <thead>
            <tr>
              <th>Task Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Duration</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Deleted At</th>
              <th nzWidth="200px">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let data of deletedTable.data">
              <td>
                <span class="task-name-cell">
                  <span nz-icon nzType="file-text" nzTheme="outline"></span>
                  {{ data.name }}
                </span>
              </td>
              <td>{{ formatDate(data.startDate) }}</td>
              <td>{{ formatDate(data.endDate) }}</td>
              <td>
                <nz-tag nzColor="blue">{{ data.duration }} days</nz-tag>
              </td>
              <td>
                <div class="progress-wrapper">
                  <div class="progress-bar-outer" [title]="data.progress + '%'">
                    <div class="progress-bar-inner" [style.width.%]="data.progress"></div>
                  </div>
                  <span class="progress-text">{{ data.progress }}%</span>
                </div>
              </td>
              <td>
                <nz-tag [nzColor]="getStatusColor(data.status)">{{ getStatusLabel(data.status) }}</nz-tag>
              </td>
              <td class="deleted-at-cell">
                {{ data.deletedAt | date:'medium' }}
              </td>
              <td>
                <div class="table-actions">
                  <button
                    nz-button
                    nzType="primary"
                    nzSize="small"
                    (click)="restoreTask(data)"
                    [nzLoading]="actionLoadingMap.get(data.id || data._id!)"
                  >
                    <span nz-icon nzType="undo"></span>
                    Restore
                  </button>
                  <button
                    nz-button
                    nzType="primary"
                    nzDanger
                    nzSize="small"
                    nz-popconfirm
                    nzPopconfirmTitle="Are you sure you want to permanently delete this task? This action cannot be undone and will permanently remove all connected dependencies."
                    (nzOnConfirm)="permanentlyDelete(data)"
                    [nzLoading]="actionLoadingMap.get(data.id || data._id!)"
                  >
                    <span nz-icon nzType="delete"></span>
                    Delete Permanently
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </nz-table>
      </div>
    </div>
  `,
  styles: [
    `
      .recently-deleted-container {
        padding: 20px;
        min-height: calc(100vh - 160px);
      }

      .card-header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
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
        margin: 0;
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
        font-weight: 600;
        color: var(--text-primary);
      }

      .progress-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        
        .progress-bar-outer {
          flex-grow: 1;
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }
        
        .progress-bar-inner {
          height: 100%;
          background: var(--primary-color);
          border-radius: 3px;
        }

        .progress-text {
          font-size: 11px;
          font-weight: 600;
          min-width: 30px;
        }
      }

      .deleted-at-cell {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .table-actions {
        display: flex;
        gap: 8px;
      }

      .enterprise-table ::ng-deep .ant-table-thead > tr > th {
        background: var(--bg-hover) !important;
        font-weight: 600;
      }
    `
  ]
})
export class RecentlyDeletedTasksComponent implements OnInit, OnDestroy {
  public selectedProjectId: string | null = null;
  public deletedTasks: Task[] = [];
  public loading = false;
  public actionLoadingMap = new Map<string, boolean>();

  private destroy$ = new Subject<void>();

  constructor(
    private store: TaskStore,
    private taskApi: TaskApiService,
    private message: NzMessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Watch project change
    this.store.selectedProjectId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        this.selectedProjectId = id;
        this.deletedTasks = [];
        if (id) {
          this.fetchDeletedTasks();
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public fetchDeletedTasks(): void {
    if (!this.selectedProjectId) return;
    this.loading = true;
    this.taskApi.getDeletedTasks(this.selectedProjectId).subscribe({
      next: (tasks) => {
        this.deletedTasks = tasks;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load deleted tasks:', err);
        this.message.error(err.message || 'Error loading deleted tasks');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  public restoreTask(task: Task): void {
    const taskId = task.id || task._id;
    if (!taskId) return;

    this.actionLoadingMap.set(taskId, true);
    this.cdr.markForCheck();

    this.taskApi.restoreTask(taskId).subscribe({
      next: () => {
        this.message.success(`Task "${task.name}" successfully restored!`);
        this.actionLoadingMap.delete(taskId);
        
        // Remove from local list
        this.deletedTasks = this.deletedTasks.filter(t => (t.id || t._id) !== taskId);

        // Sync RxJS Store
        this.refreshRxJSState();
      },
      error: (err) => {
        this.message.error(err.message || 'Failed to restore task');
        this.actionLoadingMap.delete(taskId);
        this.cdr.markForCheck();
      }
    });
  }

  public permanentlyDelete(task: Task): void {
    const taskId = task.id || task._id;
    if (!taskId) return;

    this.actionLoadingMap.set(taskId, true);
    this.cdr.markForCheck();

    this.taskApi.permanentlyDeleteTask(taskId).subscribe({
      next: () => {
        this.message.success(`Task "${task.name}" permanently deleted.`);
        this.actionLoadingMap.delete(taskId);

        // Remove from local list
        this.deletedTasks = this.deletedTasks.filter(t => (t.id || t._id) !== taskId);

        // Sync RxJS Store to clean dependencies if any active views require it
        this.refreshRxJSState();
      },
      error: (err) => {
        this.message.error(err.message || 'Failed to permanently delete task');
        this.actionLoadingMap.delete(taskId);
        this.cdr.markForCheck();
      }
    });
  }

  private refreshRxJSState(): void {
    const projectId = this.selectedProjectId;
    if (!projectId) return;

    // Re-fetch all tasks (Gantt tree flat list)
    this.taskApi.getTasks(projectId).subscribe({
      next: (tasksList) => {
        this.store.setTasks(tasksList);
      }
    });

    // Re-fetch paginated tasks (Task Inventory table)
    const pag = this.store.getSnapshot().pagination;
    this.taskApi.getPaginatedTasks(projectId, pag.page, pag.limit).subscribe({
      next: (res) => {
        this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
      }
    });

    // Re-fetch active dependencies (Gantt lines)
    this.taskApi.getDependencies(projectId).subscribe({
      next: (deps) => {
        this.store.setDependencies(deps);
      }
    });
  }

  // Formatting Helpers
  public formatDate(dateVal: any): string {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  public getStatusColor(status: string): string {
    switch (status) {
      case 'done': return 'green';
      case 'in_progress': return 'processing';
      default: return 'default';
    }
  }

  public getStatusLabel(status: string): string {
    switch (status) {
      case 'done': return 'Done';
      case 'in_progress': return 'In Progress';
      default: return 'Todo';
    }
  }
}
