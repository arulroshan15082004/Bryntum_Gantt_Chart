import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import dependencyRoutes from './routes/dependency.routes';
import resourceRoutes from './routes/resource.routes';

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increase size limit to support importing 10K tasks
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// REST API mapping
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dependencies', dependencyRoutes);
app.use('/api/resources', resourceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PM Gantt POC server is running smoothly.' });
});

export default app;
