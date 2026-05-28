import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Resource } from '../state/task-store.service';
import { GraphQLService } from './graphql.service';

@Injectable({
  providedIn: 'root',
})
export class ResourceApiService {
  constructor(private graphqlService: GraphQLService) {}

  getResources(): Observable<Resource[]> {
    return this.graphqlService.getResources();
  }

  createResource(resource: Resource): Observable<Resource> {
    const { name, role, email, availability } = resource;
    return this.graphqlService.createResource({ name, role, email, availability });
  }

  updateResource(id: string, resource: Partial<Resource>): Observable<Resource> {
    const { name, role, email, availability } = resource;
    const resourceInput: any = { name, role, email, availability };
    Object.keys(resourceInput).forEach(key => resourceInput[key] === undefined && delete resourceInput[key]);
    return this.graphqlService.updateResource(id, resourceInput);
  }

  deleteResource(id: string): Observable<any> {
    return this.graphqlService.deleteResource(id);
  }
}
