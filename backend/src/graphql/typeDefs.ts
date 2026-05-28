export const typeDefs = `#graphql
  type Project {
    id: ID!
    name: String!
    description: String
    startDate: String!
    endDate: String!
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  type Resource {
    id: ID!
    name: String!
    role: String
    email: String!
    availability: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Task {
    id: ID!
    projectId: ID!
    name: String!
    description: String
    parentId: ID
    startDate: String!
    endDate: String!
    duration: Int!
    progress: Float!
    priority: String!
    status: String!
    isMilestone: Boolean!
    resourceIds: [ID!]
    resources: [Resource!]!
    isDeleted: Boolean
    deletedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type TaskConnection {
    tasks: [Task!]!
    total: Int!
    page: Int
    limit: Int
    totalPages: Int
  }

  type Dependency {
    id: ID!
    projectId: ID!
    fromTaskId: ID!
    toTaskId: ID!
    type: String!
    lag: Int!
    isDeleted: Boolean
    deletedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    getProjects: [Project!]!
    getTasks(projectId: ID!, page: Int, limit: Int): TaskConnection!
    getDeletedTasks(projectId: ID!): [Task!]!
    getDependencies(projectId: ID!): [Dependency!]!
    getResources: [Resource!]!
  }

  type Mutation {
    createProject(name: String!, description: String, startDate: String!, endDate: String!, status: String): Project!
    updateProject(id: ID!, name: String, description: String, startDate: String, endDate: String, status: String): Project!
    deleteProject(id: ID!): String!

    createTask(
      projectId: ID!
      name: String!
      description: String
      parentId: ID
      startDate: String!
      endDate: String!
      duration: Int
      progress: Float
      priority: String
      status: String
      isMilestone: Boolean
      resourceIds: [ID!]
    ): Task!

    updateTask(
      id: ID!
      name: String
      description: String
      parentId: ID
      startDate: String
      endDate: String
      duration: Int
      progress: Float
      priority: String
      status: String
      isMilestone: Boolean
      resourceIds: [ID!]
    ): Task!

    deleteTask(id: ID!): String!
    restoreTask(id: ID!): Task!
    permanentlyDeleteTask(id: ID!): String!

    createDependency(projectId: ID!, fromTaskId: ID!, toTaskId: ID!, type: String!, lag: Int): Dependency!
    updateDependency(id: ID!, type: String, lag: Int): Dependency!
    deleteDependency(id: ID!): String!

    createResource(name: String!, role: String, email: String!, availability: Int!): Resource!
    updateResource(id: ID!, name: String, role: String, email: String, availability: Int): Resource!
    deleteResource(id: ID!): String!
  }
`;
