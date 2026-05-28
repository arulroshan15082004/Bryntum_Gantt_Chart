import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task, Dependency } from '../state/task-store.service';
import { GraphQLService } from './graphql.service';

@Injectable({
  providedIn: 'root',
})
export class TaskApiService {
  private tasksUrl = 'http://localhost:5000/api/tasks';
  private projectsUrl = 'http://localhost:5000/api/projects';

  constructor(
    private http: HttpClient,
    private graphqlService: GraphQLService
  ) {}

  // Get all tasks of a project without pagination (for Gantt tree)
  getTasks(projectId: string): Observable<Task[]> {
    return this.graphqlService.getTasks(projectId).pipe(
      map(res => res.tasks)
    );
  }

  // Get paginated tasks of a project (for AG Grid Community Infinite scrolling)
  getPaginatedTasks(
    projectId: string,
    page: number,
    limit: number
  ): Observable<{ tasks: Task[]; total: number; page: number; limit: number; totalPages: number }> {
    return this.graphqlService.getTasks(projectId, page, limit);
  }

  createTask(task: Task): Observable<Task> {
    const { projectId, name, description, parentId, startDate, endDate, duration, progress, priority, status, isMilestone, resourceIds } = task;
    const taskInput: any = { projectId, name, description, parentId: parentId || null, startDate, endDate, duration, progress, priority, status, isMilestone, resourceIds };
    Object.keys(taskInput).forEach(key => taskInput[key] === undefined && delete taskInput[key]);
    return this.graphqlService.createTask(taskInput);
  }

  updateTask(id: string, task: Partial<Task>): Observable<Task> {
    const { name, description, parentId, startDate, endDate, duration, progress, priority, status, isMilestone, resourceIds } = task;
    const taskInput: any = { name, description, parentId: parentId === undefined ? undefined : (parentId || null), startDate, endDate, duration, progress, priority, status, isMilestone, resourceIds };
    Object.keys(taskInput).forEach(key => taskInput[key] === undefined && delete taskInput[key]);
    return this.graphqlService.updateTask(id, taskInput);
  }

  bulkUpdateTasks(tasks: Partial<Task>[]): Observable<any> {
    // Keep bulk operations on REST for performance and backend bulkWrite optimization compatibility
    return this.http.put<any>(`${this.tasksUrl}/bulk`, { tasks });
  }

  deleteTask(id: string): Observable<any> {
    return this.graphqlService.deleteTask(id);
  }

  getDeletedTasks(projectId: string): Observable<Task[]> {
    return this.graphqlService.getDeletedTasks(projectId);
  }

  restoreTask(id: string): Observable<Task> {
    return this.graphqlService.restoreTask(id);
  }

  permanentlyDeleteTask(id: string): Observable<string> {
    return this.graphqlService.permanentlyDeleteTask(id);
  }

  // Dependencies API mapping
  getDependencies(projectId: string): Observable<Dependency[]> {
    return this.graphqlService.getDependencies(projectId);
  }

  createDependency(dependency: Omit<Dependency, '_id' | 'id'>): Observable<Dependency> {
    const { projectId, fromTaskId, toTaskId, type, lag } = dependency;
    return this.graphqlService.createDependency({ projectId, fromTaskId, toTaskId, type, lag });
  }

  updateDependency(id: string, dependency: Partial<Dependency>): Observable<Dependency> {
    const { type, lag } = dependency;
    return this.graphqlService.updateDependency(id, { type, lag });
  }

  deleteDependency(id: string): Observable<any> {
    return this.graphqlService.deleteDependency(id);
  }

  // Bulk CSV Upload
  importCSV(projectId: string, tasks: Partial<Task>[]): Observable<{ message: string; count: number }> {
    // Keep bulk operations on REST for performance uploader compatibility
    return this.http.post<any>(`${this.projectsUrl}/${projectId}/import-csv`, { tasks });
  }
}
