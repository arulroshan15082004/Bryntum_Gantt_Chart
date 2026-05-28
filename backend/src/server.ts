import { ApolloServer } from '@apollo/server';
const { expressMiddleware } = require('@apollo/server/express4') as any;
import express from 'express';
import cors from 'cors';
import http from 'http';
import app from './app';
import connectDB from './config/db';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 5000;

async function startServer() {
  // 1. Establish connection to local MongoDB
  await connectDB();

  const httpServer = http.createServer(app);

  // 2. Setup Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  // 3. Start GraphQL Engine
  await server.start();

  // 4. Mount GraphQL middleware with explicit body parsing and CORS
  app.use(
    '/graphql',
    cors(),
    express.json(),
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      req.body = req.body || {};
      next();
    },
    expressMiddleware(server)
  );

  // 5. Start listening to incoming requests
  httpServer.listen(port, () => {
    console.log(`🚀 REST server running at http://localhost:${port}/health`);
    console.log(`🚀 GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch((err) => {
  console.error('CRITICAL: Server crash during launch:', err);
});
