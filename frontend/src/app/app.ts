import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, ActivatedRoute } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { TaskStore } from './core/state/task-store.service';
import { ProjectApiService } from './core/services/project-api.service';
import { ResourceApiService } from './core/services/resource-api.service';
import { TaskApiService } from './core/services/task-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    NzButtonModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  public title = 'Gantt Scheduler POC';
  public isCollapsed = false;

  constructor(
    private store: TaskStore,
    private projectApi: ProjectApiService,
    private resourceApi: ResourceApiService,
    private taskApi: TaskApiService,
    private router: Router,
    private route: ActivatedRoute,
    private message: NzMessageService
  ) {}

  ngOnInit(): void {
    // 1. Initial bootstrap of all projects in database
    this.projectApi.getProjects().subscribe({
      next: (projList) => {
        this.store.setProjects(projList);

        // Check URL query parameters for projectId
        const params = new URLSearchParams(window.location.search);
        const urlProjId = params.get('projectId');

        if (urlProjId) {
          const matched = projList.find(p => (p._id || p.id) === urlProjId);
          if (matched) {
            this.store.setSelectedProject(urlProjId);
            this.loadProjectDetails(urlProjId);
          } else {
            // Invalid projectId: Show error and redirect to dashboard, clear query param
            this.message.error('Invalid Project ID. Redirecting to dashboard.');
            this.router.navigate(['/dashboard'], { queryParams: { projectId: null } });

            // Select first project as fallback if any exists
            if (projList.length > 0) {
              const firstId = (projList[0]._id || projList[0].id) as string;
              this.store.setSelectedProject(firstId);
              this.loadProjectDetails(firstId);
            }
          }
        } else if (projList.length > 0) {
          // Select first project automatically and load its details
          const firstId = (projList[0]._id || projList[0].id) as string;
          this.store.setSelectedProject(firstId);
          this.loadProjectDetails(firstId);
        }
      },
      error: (err) => {
        console.error('Bootstrap Error loading projects:', err);
      }
    });

    // 2. Initial bootstrap of resources in database
    this.resourceApi.getResources().subscribe({
      next: (resList) => {
        this.store.setResources(resList);
      },
      error: (err) => {
        console.error('Bootstrap Error loading resources:', err);
      }
    });

    // 3. Keep query parameters synchronized with selectedProjectId
    this.store.selectedProjectId$.subscribe((id) => {
      if (id) {
        const currentUrl = this.router.url.split('?')[0];
        this.router.navigate([currentUrl], {
          queryParams: { projectId: id },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }

  private loadProjectDetails(projectId: string): void {
    this.store.setLoading(true);
    
    // Sync flat tasks
    this.taskApi.getTasks(projectId).subscribe({
      next: (taskList) => {
        this.store.setTasks(taskList);
        
        // Sync paginated tasks for AG Grid
        this.taskApi.getPaginatedTasks(projectId, 1, 50).subscribe({
          next: (res) => {
            this.store.setPaginatedTasks(res.tasks, res.total, res.page, res.limit);
            this.store.setLoading(false);
          },
          error: (err) => {
            this.store.setError(err.message || 'Failed loading paginated tasks');
            this.store.setLoading(false);
          }
        });
      },
      error: (err) => {
        this.store.setError(err.message || 'Failed loading flat tasks');
        this.store.setLoading(false);
      }
    });

    // Sync dependencies
    this.taskApi.getDependencies(projectId).subscribe({
      next: (depList) => {
        this.store.setDependencies(depList);
      },
      error: (err) => {
        console.error('Failed loading dependencies:', err);
      }
    });
  }
}
