import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class GraphQLService {
  private graphqlUrl = 'http://localhost:5000/graphql';

  constructor(private http: HttpClient) {}

  // Lightweight wrapper to execute generic GraphQL queries or mutations
  public query<T>(query: string, variables: any = {}): Observable<T> {
    return this.http
      .post<{ data: T; errors?: any[] }>(this.graphqlUrl, {
        query,
        variables,
      })
      .pipe(
        map(response => {
          if (response.errors && response.errors.length > 0) {
            throw new Error(response.errors[0].message || 'GraphQL Query Error');
          }
          return response.data;
        })
      );
  }

  // --- Predefined Queries & Mutations Matching Requirements ---

  public getProjects(): Observable<any> {
    const q = `
      query GetProjects {
        getProjects {
          id
          name
          description
          startDate
          endDate
          status
          createdAt
          updatedAt
        }
      }
    `;
    return this.query<any>(q).pipe(map(d => d.getProjects));
  }

  public getTasks(projectId: string, page?: number, limit?: number): Observable<any> {
    const q = `
      query GetTasks($projectId: ID!, $page: Int, $limit: Int) {
        getTasks(projectId: $projectId, page: $page, limit: $limit) {
          tasks {
            id
            projectId
            name
            description
            parentId
            startDate
            endDate
            duration
            progress
            priority
            status
            isMilestone
            resourceIds
            resources {
              id
              name
              role
              email
            }
          }
          total
          page
          limit
          totalPages
        }
      }
    `;
    return this.query<any>(q, { projectId, page, limit }).pipe(map(d => d.getTasks));
  }

  public getDependencies(projectId: string): Observable<any> {
    const q = `
      query GetDependencies($projectId: ID!) {
        getDependencies(projectId: $projectId) {
          id
          projectId
          fromTaskId
          toTaskId
          type
          lag
        }
      }
    `;
    return this.query<any>(q, { projectId }).pipe(map(d => d.getDependencies));
  }

  public getResources(): Observable<any> {
    const q = `
      query GetResources {
        getResources {
          id
          name
          role
          email
          availability
        }
      }
    `;
    return this.query<any>(q).pipe(map(d => d.getResources));
  }

  public createTask(taskInput: any): Observable<any> {
    const q = `
      mutation CreateTask(
        $projectId: ID!
        $name: String!
        $description: String
        $parentId: ID
        $startDate: String!
        $endDate: String!
        $duration: Int
        $progress: Float
        $priority: String
        $status: String
        $isMilestone: Boolean
        $resourceIds: [ID!]
      ) {
        createTask(
          projectId: $projectId
          name: $name
          description: $description
          parentId: $parentId
          startDate: $startDate
          endDate: $endDate
          duration: $duration
          progress: $progress
          priority: $priority
          status: $status
          isMilestone: $isMilestone
          resourceIds: $resourceIds
        ) {
          id
          projectId
          name
          description
          parentId
          startDate
          endDate
          duration
          progress
          priority
          status
          isMilestone
          resourceIds
        }
      }
    `;
    return this.query<any>(q, taskInput).pipe(map(d => d.createTask));
  }

  public updateTask(id: string, taskInput: any): Observable<any> {
    const q = `
      mutation UpdateTask(
        $id: ID!
        $name: String
        $description: String
        $parentId: ID
        $startDate: String
        $endDate: String
        $duration: Int
        $progress: Float
        $priority: String
        $status: String
        $isMilestone: Boolean
        $resourceIds: [ID!]
      ) {
        updateTask(
          id: $id
          name: $name
          description: $description
          parentId: $parentId
          startDate: $startDate
          endDate: $endDate
          duration: $duration
          progress: $progress
          priority: $priority
          status: $status
          isMilestone: $isMilestone
          resourceIds: $resourceIds
        ) {
          id
          name
          description
          parentId
          startDate
          endDate
          duration
          progress
          priority
          status
          isMilestone
          resourceIds
        }
      }
    `;
    return this.query<any>(q, { id, ...taskInput }).pipe(map(d => d.updateTask));
  }

  public deleteTask(id: string): Observable<string> {
    const q = `
      mutation DeleteTask($id: ID!) {
        deleteTask(id: $id)
      }
    `;
    return this.query<any>(q, { id }).pipe(map(d => d.deleteTask));
  }

  public getDeletedTasks(projectId: string): Observable<any> {
    const q = `
      query GetDeletedTasks($projectId: ID!) {
        getDeletedTasks(projectId: $projectId) {
          id
          projectId
          name
          description
          startDate
          endDate
          duration
          progress
          priority
          status
          isMilestone
          resourceIds
          deletedAt
        }
      }
    `;
    return this.query<any>(q, { projectId }).pipe(map(d => d.getDeletedTasks));
  }

  public restoreTask(id: string): Observable<any> {
    const q = `
      mutation RestoreTask($id: ID!) {
        restoreTask(id: $id) {
          id
          projectId
          name
          startDate
          endDate
          duration
          progress
          priority
          status
        }
      }
    `;
    return this.query<any>(q, { id }).pipe(map(d => d.restoreTask));
  }

  public permanentlyDeleteTask(id: string): Observable<string> {
    const q = `
      mutation PermanentlyDeleteTask($id: ID!) {
        permanentlyDeleteTask(id: $id)
      }
    `;
    return this.query<any>(q, { id }).pipe(map(d => d.permanentlyDeleteTask));
  }

  public createProject(projectInput: any): Observable<any> {
    const q = `
      mutation CreateProject($name: String!, $description: String, $startDate: String!, $endDate: String!, $status: String) {
        createProject(name: $name, description: $description, startDate: $startDate, endDate: $endDate, status: $status) {
          id
          name
          description
          startDate
          endDate
          status
        }
      }
    `;
    return this.query<any>(q, projectInput).pipe(map(d => d.createProject));
  }

  public updateProject(id: string, projectInput: any): Observable<any> {
    const q = `
      mutation UpdateProject($id: ID!, $name: String, $description: String, $startDate: String, $endDate: String, $status: String) {
        updateProject(id: $id, name: $name, description: $description, startDate: $startDate, endDate: $endDate, status: $status) {
          id
          name
          description
          startDate
          endDate
          status
        }
      }
    `;
    return this.query<any>(q, { id, ...projectInput }).pipe(map(d => d.updateProject));
  }

  public deleteProject(id: string): Observable<string> {
    const q = `
      mutation DeleteProject($id: ID!) {
        deleteProject(id: $id)
      }
    `;
    return this.query<any>(q, { id }).pipe(map(d => d.deleteProject));
  }

  // --- Dependency Mutations ---

  public createDependency(depInput: any): Observable<any> {
    const q = `
      mutation CreateDependency($projectId: ID!, $fromTaskId: ID!, $toTaskId: ID!, $type: String!, $lag: Int) {
        createDependency(projectId: $projectId, fromTaskId: $fromTaskId, toTaskId: $toTaskId, type: $type, lag: $lag) {
          id
          projectId
          fromTaskId
          toTaskId
          type
          lag
        }
      }
    `;
    return this.query<any>(q, depInput).pipe(map(d => d.createDependency));
  }

  public updateDependency(id: string, depInput: any): Observable<any> {
    const q = `
      mutation UpdateDependency($id: ID!, $type: String, $lag: Int) {
        updateDependency(id: $id, type: $type, lag: $lag) {
          id
          projectId
          fromTaskId
          toTaskId
          type
          lag
        }
      }
    `;
    return this.query<any>(q, { id, ...depInput }).pipe(map(d => d.updateDependency));
  }

  public deleteDependency(id: string): Observable<string> {
    const q = `
      mutation DeleteDependency($id: ID!) {
        deleteDependency(id: $id)
      }
    `;
    return this.query<any>(q, { id }).pipe(map(d => d.deleteDependency));
  }

  // --- Resource Mutations ---

  public createResource(resInput: any): Observable<any> {
    const q = `
      mutation CreateResource($name: String!, $role: String, $email: String!, $availability: Int!) {
        createResource(name: $name, role: $role, email: $email, availability: $availability) {
          id
          name
          role
          email
          availability
        }
      }
    `;
    return this.query<any>(q, resInput).pipe(map(d => d.createResource));
  }

  public updateResource(id: string, resInput: any): Observable<any> {
    const q = `
      mutation UpdateResource($id: ID!, $name: String, $role: String, $email: String, $availability: Int) {
        updateResource(id: $id, name: $name, role: $role, email: $email, availability: $availability) {
          id
          name
          role
          email
          availability
        }
      }
    `;
    return this.query<any>(q, { id, ...resInput }).pipe(map(d => d.updateResource));
  }

  public deleteResource(id: string): Observable<string> {
    const q = `
      mutation DeleteResource($id: ID!) {
        deleteResource(id: $id)
      }
    `;
    return this.query<any>(q, { id }).pipe(map(d => d.deleteResource));
  }
}
