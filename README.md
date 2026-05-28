# Full-Stack Project Management Gantt POC

An enterprise-grade, high-performance Project Management Gantt application built using a modern, scalable tech stack. Designed with a professional SAP-style clean white & blue accent user interface, supporting virtual scrolling, compound indexing, server-side pagination, and an interactive Gantt chart.

## 🛠️ Technology Stack

- **Frontend**: Angular (latest standalone components), TypeScript, RxJS global state store (`BehaviorSubject`), SCSS styling, NG-ZORRO UI components, and AG Grid.
- **Backend**: Node.js, Express, TypeScript, REST API, and GraphQL API (Apollo Server v4).
- **Database**: MongoDB, Mongoose ODM.
- **Performance Ingestion**: CSV Bulk Task Uploader for performance benchmarking (supporting 10,000+ tasks).

---

## 🚀 Terminal Run Commands

Ensure you have a local MongoDB instance running at `mongodb://127.0.0.1:27017/pm_gantt_poc` or update the `.env` configuration file in the backend.

### 1. Database Setup
Create a local MongoDB database named `pm_gantt_poc`. The application will automatically construct collections (`projects`, `tasks`, `dependencies`, `resources`) and register compound indexes on startup.

### 2. Launch Backend Express & Apollo Server
```bash
cd backend
npm install
npm run dev
```
- **REST Health Check**: http://localhost:5000/health
- **GraphQL Apollo Studio Playground**: http://localhost:5000/graphql

### 3. Launch Frontend Angular Application
```bash
cd frontend
npm install
ng serve
```
- **Frontend Workspace**: http://localhost:4200

---

## 📊 Performance Scaling Architecture (10,000+ Tasks)

Following strict performance criteria, the POC implements a highly scalable architecture that eliminates front-to-back browser freezing:

1. **Database Level (Mongoose Indexes)**:
   - Single and compound indexes created on high-frequency queries:
     - `Task.projectId` & `Task.parentId` (Tree Grid pathing)
     - `Task.projectId` & `Task.startDate` & `Task.endDate` (Gantt Schedule pathing)
     - `Dependency.projectId` (Scheduler links pathing)
     - `Resource.email` (Unique resource validation check)

2. **Backend Pagination**:
   - `GET /api/tasks?projectId=&page=&limit=` and GraphQL query `getTasks(projectId, page, limit)` support server-side offset pagination, returning only the requested slice of data and total count metadata in a single fast parallel query.

3. **AG Grid Community Infinite Row Model**:
   - The task inventory grid uses `rowModelType="infinite"`. As the user scrolls, AG Grid dynamically requests data blocks of 50 tasks from the backend, discarding off-screen DOM nodes to support 10,000+ rows with zero lag.

4. **Timeline Partitioning (Selected Project Loading)**:
   - To prevent rendering huge trees, the Gantt timeline loads tasks partitioned strictly by the selected project.

---

## 📥 Performance Bulk CSV Task Ingestion

To facilitate immediate performance testing of 10,000+ tasks without mock data, a bulk CSV uploader is provided in the **Task Inventory** tab.

### CSV Header Format:
To upload tasks in bulk, create a `.csv` file with the following headers:
`id,parentId,name,description,startDate,endDate,duration,progress,priority,status,isMilestone`

*Example Content:*
```csv
id,parentId,name,description,startDate,endDate,duration,progress,priority,status,isMilestone
T1,,Summary Stage 1,Parent Stage,2026-05-20,2026-05-30,10,30,high,in_progress,false
T2,T1,Task 1.1,Subtask 1,2026-05-20,2026-05-25,5,60,medium,in_progress,false
T3,T1,Task 1.2,Subtask 2,2026-05-25,2026-05-30,5,0,low,todo,false
T4,T1,Milestone 1,Complete Gate 1,2026-05-30,2026-05-30,0,0,high,todo,true
```

Upon upload, the backend parses headers, uploads records using a single high-speed `insertMany`, and resolves parent-child `parentId` ObjectIds using a Mongoose `bulkWrite` operation.

---

## 🎨 Bryntum Gantt Integration Configuration

A standard Bryntum Gantt wrapper structure is included in the project features. If you possess an active Bryntum registry token, follow these instructions to switch from the high-fidelity SVG standalone fallback Gantt to the Bryntum commercial package:

### 1. Registry Credentials Configuration
Create an `.npmrc` file in the `frontend/` directory:
```npmrc
@bryntum:registry=https://npm.bryntum.com
//npm.bryntum.com/:_authToken=YOUR_BRYNTUM_LICENSE_TOKEN
```

### 2. Install Bryntum Dependencies
```bash
cd frontend
npm install @bryntum/gantt @bryntum/gantt-angular
```

### 3. Register Bryntum Module in Angular Components
Import the `BryntumGanttModule` in standalone view components:
```typescript
import { BryntumGanttModule } from '@bryntum/gantt-angular';

@Component({
  // ...
  imports: [CommonModule, BryntumGanttModule]
})
```

### 4. Bind Gantt Workspace
In `gantt-view.component.html`, replace the fallback SVG tag with:
```html
<bryntum-gantt
  [tasks]="tasks$"
  [dependencies]="dependencies$"
  [resources]="resources$"
  (onTaskUpdated)="onTaskUpdated($event)"
></bryntum-gantt>
```
All state bindings, store structures, and MongoDB REST endpoints are pre-wired to support instant Bryntum Gantt synchronization!
