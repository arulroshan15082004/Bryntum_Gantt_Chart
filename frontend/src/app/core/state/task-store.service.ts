import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

export interface Project {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

export interface Resource {
  _id?: string;
  id?: string;
  name: string;
  role?: string;
  email: string;
  availability: number;
}

export interface Task {
  _id?: string;
  id?: string;
  projectId: string;
  name: string;
  description?: string;
  parentId?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  duration: number;
  progress: number;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  isMilestone: boolean;
  resourceIds: string[];
  resources?: Resource[];
  isDeleted?: boolean;
  deletedAt?: string | Date;
  createdAt?: string;
  updatedAt?: string;
  
  // Custom Gantt UI properties
  expanded?: boolean;
  children?: Task[];
}

export interface Dependency {
  _id?: string;
  id?: string;
  projectId: string;
  fromTaskId: string;
  toTaskId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
}

export interface TaskState {
  projects: Project[];
  selectedProjectId: string | null;
  tasks: Task[]; // Full task list for Gantt tree building
  paginatedTasks: Task[]; // Lazy-loaded paginated tasks for AG Grid
  dependencies: Dependency[];
  resources: Resource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;
}

const initialState: TaskState = {
  projects: [],
  selectedProjectId: null,
  tasks: [],
  paginatedTasks: [],
  dependencies: [],
  resources: [],
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  loading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class TaskStore {
  private state$ = new BehaviorSubject<TaskState>(initialState);

  // Selectors
  public readonly projects$: Observable<Project[]> = this.state$.pipe(map(state => state.projects));
  public readonly selectedProjectId$: Observable<string | null> = this.state$.pipe(
    map(state => state.selectedProjectId),
    distinctUntilChanged()
  );
  public readonly tasks$: Observable<Task[]> = this.state$.pipe(map(state => state.tasks));
  public readonly paginatedTasks$: Observable<Task[]> = this.state$.pipe(map(state => state.paginatedTasks));
  public readonly dependencies$: Observable<Dependency[]> = this.state$.pipe(map(state => state.dependencies));
  public readonly resources$: Observable<Resource[]> = this.state$.pipe(map(state => state.resources));
  public readonly pagination$: Observable<TaskState['pagination']> = this.state$.pipe(map(state => state.pagination));
  public readonly loading$: Observable<boolean> = this.state$.pipe(
    map(state => state.loading),
    distinctUntilChanged()
  );
  public readonly error$: Observable<string | null> = this.state$.pipe(
    map(state => state.error),
    distinctUntilChanged()
  );

  // Get selected project info
  public readonly selectedProject$: Observable<Project | null> = this.state$.pipe(
    map(state => state.projects.find(p => p._id === state.selectedProjectId || p.id === state.selectedProjectId) || null)
  );

  // Hierarchy Tree Builder for Bryntum/SVG Gantt View
  public readonly taskTree$: Observable<Task[]> = this.state$.pipe(
    map(state => this.buildHierarchyTree(state.tasks))
  );

  constructor() {}

  // Get raw snapshot of current state
  public getSnapshot(): TaskState {
    return this.state$.getValue();
  }

  // Update State Slice
  private updateState(updatedFields: Partial<TaskState>): void {
    this.state$.next({
      ...this.getSnapshot(),
      ...updatedFields,
    });
  }

  // Action Methods
  public setProjects(projects: Project[]): void {
    this.updateState({ projects });
    // Default to select first project if none is selected
    const currentSelected = this.getSnapshot().selectedProjectId;
    if (!currentSelected && projects.length > 0) {
      this.setSelectedProject((projects[0]._id || projects[0].id) as string);
    }
  }

  public setSelectedProject(projectId: string | null): void {
    this.updateState({ selectedProjectId: projectId, tasks: [], paginatedTasks: [], dependencies: [] });
  }

  public setTasks(tasks: Task[]): void {
    this.updateState({ tasks });
  }

  public setPaginatedTasks(tasks: Task[], total: number, page: number, limit: number): void {
    const totalPages = Math.ceil(total / limit);
    this.updateState({
      paginatedTasks: tasks,
      pagination: { page, limit, total, totalPages },
    });
  }

  public setDependencies(dependencies: Dependency[]): void {
    this.updateState({ dependencies });
  }

  public setResources(resources: Resource[]): void {
    this.updateState({ resources });
  }

  public setLoading(loading: boolean): void {
    this.updateState({ loading });
  }

  public setError(error: string | null): void {
    this.updateState({ error });
  }

  // Optimistic/Local State Mutation Helpers for instant UI response
  public localAddTask(task: Task): void {
    const state = this.getSnapshot();
    this.updateState({
      tasks: [...state.tasks, task],
      paginatedTasks: [...state.paginatedTasks, task],
    });
  }

  public localUpdateTask(updatedTask: Partial<Task> & { _id?: string; id?: string }): void {
    const state = this.getSnapshot();
    const matchId = updatedTask._id || updatedTask.id;
    
    const tasks = state.tasks.map(t => (t._id === matchId || t.id === matchId ? { ...t, ...updatedTask } : t));
    const paginatedTasks = state.paginatedTasks.map(t => (t._id === matchId || t.id === matchId ? { ...t, ...updatedTask } : t));
    
    this.updateState({ tasks, paginatedTasks });
  }

  public localUpdateTasks(updatedTasks: (Partial<Task> & { _id?: string; id?: string })[]): void {
    const state = this.getSnapshot();
    
    const tasks = state.tasks.map(t => {
      const match = updatedTasks.find(ut => {
        const utId = ut._id || ut.id;
        const tId = t._id || t.id;
        return utId && tId && utId.toString() === tId.toString();
      });
      return match ? { ...t, ...match } : t;
    });

    const paginatedTasks = state.paginatedTasks.map(t => {
      const match = updatedTasks.find(ut => {
        const utId = ut._id || ut.id;
        const tId = t._id || t.id;
        return utId && tId && utId.toString() === tId.toString();
      });
      return match ? { ...t, ...match } : t;
    });
    
    this.updateState({ tasks, paginatedTasks });
  }

  public localDeleteTask(taskId: string): void {
    const state = this.getSnapshot();
    const tasks = state.tasks.filter(t => t._id !== taskId && t.id !== taskId);
    const paginatedTasks = state.paginatedTasks.filter(t => t._id !== taskId && t.id !== taskId);
    
    // Clear dependencies associated with the deleted task
    const dependencies = state.dependencies.filter(d => d.fromTaskId !== taskId && d.toTaskId !== taskId);

    this.updateState({ tasks, paginatedTasks, dependencies });
  }

  public localAddDependency(dep: Dependency): void {
    const state = this.getSnapshot();
    this.updateState({ dependencies: [...state.dependencies, dep] });
  }

  public localUpdateDependency(updatedDep: Partial<Dependency> & { _id?: string; id?: string }): void {
    const state = this.getSnapshot();
    const matchId = updatedDep._id || updatedDep.id;
    const dependencies = state.dependencies.map(d =>
      d._id === matchId || d.id === matchId ? { ...d, ...updatedDep } : d
    );
    this.updateState({ dependencies });
  }

  public localDeleteDependency(depId: string): void {
    const state = this.getSnapshot();
    const dependencies = state.dependencies.filter(d => d._id !== depId && d.id !== depId);
    this.updateState({ dependencies });
  }

  public localAddResource(res: Resource): void {
    const state = this.getSnapshot();
    this.updateState({ resources: [...state.resources, res] });
  }

  // Tree building algorithm to construct parent-child relationships
  private buildHierarchyTree(flatTasks: Task[]): Task[] {
    if (!flatTasks || flatTasks.length === 0) return [];

    // Map Tasks for constant-time lookup
    const map = new Map<string, Task>();
    const roots: Task[] = [];

    // Create deep copies to avoid state mutation
    flatTasks.forEach(task => {
      const id = task._id || task.id || '';
      map.set(id, { ...task, children: [], expanded: true });
    });

    // Populate children
    map.forEach(task => {
      const parentId = task.parentId;
      if (parentId && map.has(parentId)) {
        map.get(parentId)!.children!.push(task);
      } else {
        roots.push(task);
      }
    });

    return roots;
  }
}
