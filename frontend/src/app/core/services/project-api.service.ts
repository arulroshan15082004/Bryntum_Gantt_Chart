import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Project } from '../state/task-store.service';
import { GraphQLService } from './graphql.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectApiService {
  constructor(private graphqlService: GraphQLService) {}

  getProjects(): Observable<Project[]> {
    return this.graphqlService.getProjects();
  }

  getProject(id: string): Observable<Project> {
    // If ever needed, we can query projects and filter, but we delegate to graphqlService directly
    // by using a simple mapping or custom query if necessary.
    return this.graphqlService.getProjects().pipe(
      // fallback just in case
      map((projects: Project[]) => projects.find(p => p.id === id || p._id === id)!)
    );
  }

  createProject(project: Project): Observable<Project> {
    const { name, description, startDate, endDate, status } = project;
    return this.graphqlService.createProject({ name, description, startDate, endDate, status });
  }

  updateProject(id: string, project: Partial<Project>): Observable<Project> {
    const { name, description, startDate, endDate, status } = project;
    const projectInput: any = { name, description, startDate, endDate, status };
    Object.keys(projectInput).forEach(key => projectInput[key] === undefined && delete projectInput[key]);
    return this.graphqlService.updateProject(id, projectInput);
  }

  deleteProject(id: string): Observable<any> {
    return this.graphqlService.deleteProject(id);
  }
}
