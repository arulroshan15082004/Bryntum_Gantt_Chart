import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { GanttViewComponent } from './features/gantt-view/gantt-view.component';
import { TaskTableComponent } from './features/task-table/task-table.component';
import { ResourcesComponent } from './features/resources/resources.component';
import { ProjectsComponent } from './features/projects/projects.component';
import { DependenciesComponent } from './features/dependencies/dependencies.component';
import { RecentlyDeletedTasksComponent } from './features/recently-deleted-tasks/recently-deleted-tasks.component';

export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent },
  { path: 'gantt', component: GanttViewComponent },
  { path: 'table', component: TaskTableComponent },
  { path: 'resources', component: ResourcesComponent },
  { path: 'projects', component: ProjectsComponent },
  { path: 'dependencies', component: DependenciesComponent },
  { path: 'recently-deleted-tasks', component: RecentlyDeletedTasksComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
