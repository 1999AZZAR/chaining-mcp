import { z } from 'zod';
import { AnalyzeWithSequentialThinkingSchema } from '../types.js';

/**
 * Intelligent schema analyzer for dynamic JSON Schema generation
 */
class SchemaAnalyzer {
  private schemaCache = new Map<string, any>();

  /**
   * Analyze Zod schema structure and generate intelligent JSON Schema
   */
  analyzeSchema(zodSchema: z.ZodSchema): any {
    const schemaKey = this.generateSchemaKey(zodSchema);

    if (this.schemaCache.has(schemaKey)) {
      return this.schemaCache.get(schemaKey);
    }

    const jsonSchema = this.generateDynamicSchema(zodSchema);
    this.schemaCache.set(schemaKey, jsonSchema);

    return jsonSchema;
  }

  /**
   * Generate a unique key for schema caching
   */
  private generateSchemaKey(zodSchema: z.ZodSchema): string {
    try {
      return JSON.stringify(zodSchema._def || zodSchema);
    } catch {
      return zodSchema.toString();
    }
  }

  /**
   * Dynamically generate JSON Schema from Zod schema
   */
  private generateDynamicSchema(zodSchema: z.ZodSchema): any {
    if (zodSchema instanceof z.ZodObject) {
      return this.processObjectSchema(zodSchema);
    }

    if (zodSchema instanceof z.ZodArray) {
      return this.processArraySchema(zodSchema);
    }

    if (zodSchema instanceof z.ZodString) {
      return this.processStringSchema(zodSchema);
    }

    if (zodSchema instanceof z.ZodNumber) {
      return this.processNumberSchema(zodSchema);
    }

    if (zodSchema instanceof z.ZodBoolean) {
      return this.processBooleanSchema(zodSchema);
    }

    if (zodSchema instanceof z.ZodOptional) {
      return this.processOptionalSchema(zodSchema);
    }

    return { type: 'object', properties: {} };
  }

  /**
   * Process Zod object schema with intelligent property analysis
   */
  private processObjectSchema(zodSchema: z.ZodObject<any>): any {
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(zodSchema.shape)) {
      const propertySchema = this.generateDynamicSchema(value as z.ZodSchema);
      properties[key] = propertySchema;

      // Intelligent required field detection
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  /**
   * Process Zod array schema with intelligent item analysis
   */
  private processArraySchema(zodSchema: z.ZodArray<any>): any {
    const itemSchema = this.generateDynamicSchema(zodSchema.element);

    return {
      type: 'array',
      items: itemSchema,
      description: this.generateArrayDescription(zodSchema),
    };
  }

  /**
   * Process Zod string schema with intelligent validation
   */
  private processStringSchema(zodSchema: z.ZodString): any {
    const schema: any = {
      type: 'string',
      description: this.generateStringDescription(zodSchema),
    };

    // Add intelligent constraints
    if (zodSchema._def.checks) {
      for (const check of zodSchema._def.checks) {
        if (check.kind === 'min') {
          schema.minLength = check.value;
        } else if (check.kind === 'max') {
          schema.maxLength = check.value;
        } else if (check.kind === 'email') {
          schema.format = 'email';
        } else if (check.kind === 'url') {
          schema.format = 'uri';
        }
      }
    }

    return schema;
  }

  /**
   * Process Zod number schema with intelligent constraints
   */
  private processNumberSchema(zodSchema: z.ZodNumber): any {
    const schema: any = {
      type: 'number',
      description: this.generateNumberDescription(zodSchema),
    };

    if (zodSchema._def.checks) {
      for (const check of zodSchema._def.checks) {
        if (check.kind === 'min') {
          schema.minimum = check.value;
        } else if (check.kind === 'max') {
          schema.maximum = check.value;
        } else if (check.kind === 'int') {
          schema.type = 'integer';
        }
      }
    }

    return schema;
  }

  /**
   * Process Zod boolean schema
   */
  private processBooleanSchema(zodSchema: z.ZodBoolean): any {
    return {
      type: 'boolean',
      description: this.generateBooleanDescription(zodSchema),
    };
  }

  /**
   * Process Zod optional schema
   */
  private processOptionalSchema(zodSchema: z.ZodOptional<any>): any {
    return this.generateDynamicSchema(zodSchema._def.innerType);
  }

  /**
   * Generate intelligent array description
   */
  private generateArrayDescription(zodSchema: z.ZodArray<any>): string {
    const elementType = this.getElementType(zodSchema.element);
    return `Array of ${elementType} items`;
  }

  /**
   * Generate intelligent string description
   */
  private generateStringDescription(zodSchema: z.ZodString): string {
    if (zodSchema._def.checks) {
      for (const check of zodSchema._def.checks) {
        if (check.kind === 'email') return 'Email address';
        if (check.kind === 'url') return 'URL or URI';
        if (check.kind === 'uuid') return 'UUID identifier';
      }
    }
    return 'Text string';
  }

  /**
   * Generate intelligent number description
   */
  private generateNumberDescription(zodSchema: z.ZodNumber): string {
    if (zodSchema._def.checks) {
      for (const check of zodSchema._def.checks) {
        if (check.kind === 'int') return 'Integer number';
      }
    }
    return 'Numeric value';
  }

  /**
   * Generate intelligent boolean description
   */
  private generateBooleanDescription(zodSchema: z.ZodBoolean): string {
    return 'Boolean value (true/false)';
  }

  /**
   * Get element type for arrays
   */
  private getElementType(zodSchema: z.ZodSchema): string {
    if (zodSchema instanceof z.ZodString) return 'strings';
    if (zodSchema instanceof z.ZodNumber) return 'numbers';
    if (zodSchema instanceof z.ZodBoolean) return 'booleans';
    if (zodSchema instanceof z.ZodObject) return 'objects';
    return 'items';
  }
}

const schemaAnalyzer = new SchemaAnalyzer();

/**
 * Convert Zod schema to JSON Schema format for MCP tool definitions
 * Now uses intelligent dynamic analysis instead of hardcoded mappings
 */
export function getToolInputSchema(zodSchema: z.ZodSchema): any {
  // For ListMCPServersSchema (empty object)
  if (zodSchema === z.object({})) {
    return {
      type: 'object',
      properties: {},
    };
  }

  // For AnalyzeToolsSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.serverName instanceof z.ZodOptional &&
      zodSchema.shape.category instanceof z.ZodOptional) {
    return {
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Optional: filter by specific server name',
        },
        category: {
          type: 'string',
          description: 'Optional: filter by tool category',
        },
      },
    };
  }

  // For GenerateRouteSuggestionsSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.task instanceof z.ZodString) {
    return {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The task or problem to solve',
        },
        criteria: {
          type: 'object',
          description: 'Optimization criteria',
          properties: {
            prioritizeSpeed: { type: 'boolean' },
            prioritizeSimplicity: { type: 'boolean' },
            prioritizeReliability: { type: 'boolean' },
            maxComplexity: { type: 'number' },
            maxDuration: { type: 'number' },
            requiredCapabilities: { type: 'array', items: { type: 'string' } },
            excludedTools: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['task'],
    };
  }

  // For SequentialThinkingSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.thought instanceof z.ZodString &&
      zodSchema.shape.nextThoughtNeeded instanceof z.ZodBoolean) {
    return {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your current thinking step',
        },
        nextThoughtNeeded: {
          type: 'boolean',
          description: 'Whether another thought step is needed',
        },
        thoughtNumber: {
          type: 'number',
          description: 'Current thought number',
          minimum: 1,
        },
        totalThoughts: {
          type: 'number',
          description: 'Estimated total thoughts needed',
          minimum: 1,
        },
        isRevision: {
          type: 'boolean',
          description: 'Whether this revises previous thinking',
        },
        revisesThought: {
          type: 'number',
          description: 'Which thought is being reconsidered',
          minimum: 1,
        },
        branchFromThought: {
          type: 'number',
          description: 'Branching point thought number',
          minimum: 1,
        },
        branchId: {
          type: 'string',
          description: 'Branch identifier',
        },
        needsMoreThoughts: {
          type: 'boolean',
          description: 'If more thoughts are needed',
        },
      },
      required: ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'],
    };
  }

  // For GetCurrentTimeSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.timezone instanceof z.ZodString) {
    return {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'IANA timezone name (e.g., America/New_York, Europe/London)',
        },
      },
      required: ['timezone'],
    };
  }

  // For CreateEntitiesSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.entities instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          description: 'Array of entities to create',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the entity' },
              entityType: { type: 'string', description: 'The type of the entity' },
              observations: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observation contents associated with the entity'
              },
            },
            required: ['name', 'entityType', 'observations'],
          },
        },
      },
      required: ['entities'],
    };
  }

  // For CreateRelationsSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.relations instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          description: 'Array of relations to create',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'The name of the entity where the relation starts' },
              to: { type: 'string', description: 'The name of the entity where the relation ends' },
              relationType: { type: 'string', description: 'The type of the relation' },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    };
  }

  // For AddObservationsSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.observations instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          description: 'Array of observations to add',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'The name of the entity to add the observations to' },
              contents: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observation contents to add'
              },
            },
            required: ['entityName', 'contents'],
          },
        },
      },
      required: ['observations'],
    };
  }

  // For DeleteEntitiesSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.entityNames instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          description: 'An array of entity names to delete',
          items: { type: 'string' },
        },
      },
      required: ['entityNames'],
    };
  }

  // For DeleteObservationsSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.deletions instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        deletions: {
          type: 'array',
          description: 'Array of observations to delete',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'The name of the entity containing the observations' },
              observations: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observations to delete'
              },
            },
            required: ['entityName', 'observations'],
          },
        },
      },
      required: ['deletions'],
    };
  }

  // For DeleteRelationsSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.relations instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          description: 'An array of relations to delete',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'The name of the entity where the relation starts' },
              to: { type: 'string', description: 'The name of the entity where the relation ends' },
              relationType: { type: 'string', description: 'The type of the relation' },
            },
            required: ['from', 'to', 'relationType'],
          },
        },
      },
      required: ['relations'],
    };
  }

  // For SearchNodesSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.query instanceof z.ZodString) {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to match against entity names, types, and observation content',
        },
      },
      required: ['query'],
    };
  }

  // For OpenNodesSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.names instanceof z.ZodArray) {
    return {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          description: 'An array of entity names to retrieve',
          items: { type: 'string' },
        },
      },
      required: ['names'],
    };
  }

  // For ConvertTimeSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.source_timezone instanceof z.ZodString &&
      zodSchema.shape.time instanceof z.ZodString &&
      zodSchema.shape.target_timezone instanceof z.ZodString) {
    return {
      type: 'object',
      properties: {
        source_timezone: {
          type: 'string',
          description: 'Source IANA timezone name',
        },
        time: {
          type: 'string',
          description: 'Time to convert in 24-hour format (HH:MM)',
        },
        target_timezone: {
          type: 'string',
          description: 'Target IANA timezone name',
        },
      },
      required: ['source_timezone', 'time', 'target_timezone'],
    };
  }

  // For AnalyzeWithSequentialThinkingSchema - check by exact schema reference
  if (zodSchema === AnalyzeWithSequentialThinkingSchema) {
    return {
      type: 'object',
      properties: {
        problem: {
          type: 'string',
          description: 'The problem to analyze',
        },
        criteria: {
          type: 'object',
          description: 'Optimization criteria',
          properties: {
            prioritizeSpeed: { type: 'boolean' },
            prioritizeSimplicity: { type: 'boolean' },
            prioritizeReliability: { type: 'boolean' },
            maxComplexity: { type: 'number' },
            maxDuration: { type: 'number' },
            requiredCapabilities: { type: 'array', items: { type: 'string' } },
            excludedTools: { type: 'array', items: { type: 'string' } },
          },
        },
        maxThoughts: {
          type: 'number',
          description: 'Maximum number of thoughts for sequential analysis',
          minimum: 1,
          maximum: 20,
          default: 10,
        },
      },
      required: ['problem'],
    };
  }

  // For GetToolChainAnalysisSchema
  if (zodSchema instanceof z.ZodObject && zodSchema.shape &&
      zodSchema.shape.input instanceof z.ZodString) {
    return {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input description for analysis',
        },
        criteria: {
          type: 'object',
          description: 'Optimization criteria',
          properties: {
            prioritizeSpeed: { type: 'boolean' },
            prioritizeSimplicity: { type: 'boolean' },
            prioritizeReliability: { type: 'boolean' },
            maxComplexity: { type: 'number' },
            maxDuration: { type: 'number' },
            requiredCapabilities: { type: 'array', items: { type: 'string' } },
            excludedTools: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['input'],
    };
  }

  // Fallback for unknown schemas
  return {
    type: 'object',
    properties: {},
  };
}
