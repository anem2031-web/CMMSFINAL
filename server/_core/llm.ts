import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  /** End-to-end deadline, including model discovery, retry and response body. */
  timeoutMs?: number;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiBaseUrl = () => {
  if (!ENV.deepSeekApiUrl || ENV.deepSeekApiUrl.trim().length === 0) {
    throw new Error("DEEPSEEK_API_URL is not configured");
  }

  const normalizedUrl = ENV.deepSeekApiUrl.trim().replace(/\/+$/, "");
  return normalizedUrl.endsWith("/v1")
    ? normalizedUrl.slice(0, -3)
    : normalizedUrl;
};

const resolveApiUrl = () => `${resolveApiBaseUrl()}/chat/completions`;
const resolveModelsUrl = () => `${resolveApiBaseUrl()}/models`;

const assertApiKey = () => {
  if (!ENV.deepSeekApiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not configured (legacy BUILT_IN_FORGE_API_KEY fallback is also empty)"
    );
  }
};

type DeepSeekModelsResponse = {
  object?: string;
  data?: Array<{
    id?: string;
    object?: string;
    owned_by?: string;
  }>;
};

const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MODEL_RETRY_CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_DEEPSEEK_MODEL = "deepseek-v4-flash";

let cachedDeepSeekModel: string | null = null;
let cachedDeepSeekModelExpiresAt = 0;
let modelResolutionPromise: Promise<string> | null = null;

const selectDeepSeekModel = (models: string[]): string => {
  const availableModels = Array.from(
    new Set(models.map(model => model.trim()).filter(Boolean))
  );

  if (availableModels.length === 0) {
    throw new Error("DeepSeek did not return any available models");
  }

  // Prefer the current DeepSeek V4 production models.
  const exactPreference = [
    "deepseek-v4-flash",
    "deepseek-v4-pro",
  ];

  for (const preferredModel of exactPreference) {
    const match = availableModels.find(
      model => model.toLowerCase() === preferredModel
    );
    if (match) return match;
  }

  const patternPreference = [/flash/i, /pro/i, /deepseek/i];
  for (const pattern of patternPreference) {
    const match = availableModels.find(model => pattern.test(model));
    if (match) return match;
  }

  return availableModels[0];
};

const fetchAvailableDeepSeekModel = async (signal?: AbortSignal): Promise<string> => {
  assertApiKey();

  const response = await fetch(resolveModelsUrl(), {
    method: "GET",
    signal,
    headers: {
      authorization: `Bearer ${ENV.deepSeekApiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to list DeepSeek models: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = (await response.json()) as DeepSeekModelsResponse;
  const models = Array.isArray(result.data)
    ? result.data
        .map(model => model.id)
        .filter((id): id is string => typeof id === "string")
    : [];

  return selectDeepSeekModel(models);
};

const resolveDeepSeekModel = async (
  forceRefresh = false,
  signal?: AbortSignal,
): Promise<string> => {
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedDeepSeekModel &&
    now < cachedDeepSeekModelExpiresAt
  ) {
    return cachedDeepSeekModel;
  }

  // Timed callers own their discovery request: cancelling one must not abort
  // another caller or wait on an older, unbounded shared discovery.
  if (!signal && modelResolutionPromise) {
    return modelResolutionPromise;
  }

  const previousModel = cachedDeepSeekModel;

  const resolveModel = async () => {
    try {
      const selectedModel = await fetchAvailableDeepSeekModel(signal);
      cachedDeepSeekModel = selectedModel;
      cachedDeepSeekModelExpiresAt = Date.now() + MODEL_CACHE_TTL_MS;
      console.info(`[DeepSeek] Selected model: ${selectedModel}`);
      return selectedModel;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      const fallbackModel = previousModel ?? FALLBACK_DEEPSEEK_MODEL;
      cachedDeepSeekModel = fallbackModel;
      cachedDeepSeekModelExpiresAt = Date.now() + MODEL_RETRY_CACHE_TTL_MS;
      console.warn(
        `[DeepSeek] Could not refresh the model list; using ${fallbackModel}`,
        error
      );
      return fallbackModel;
    }
  };

  if (signal) return resolveModel();
  modelResolutionPromise = resolveModel();
  try {
    return await modelResolutionPromise;
  } finally {
    modelResolutionPromise = null;
  }
};

const isModelSelectionError = (status: number, errorText: string): boolean => {
  if (![400, 404, 422].includes(status)) return false;

  return /(model).*(not found|does not exist|invalid|unsupported|unavailable|deprecated)|(not found|does not exist|invalid|unsupported|unavailable|deprecated).*(model)/i.test(
    errorText
  );
};

const sendDeepSeekRequest = async (
  payload: Record<string, unknown>,
  allowModelRefresh = true,
  signal?: AbortSignal,
): Promise<InvokeResult> => {
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.deepSeekApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return (await response.json()) as InvokeResult;
  }

  const errorText = await response.text();

  if (
    allowModelRefresh &&
    isModelSelectionError(response.status, errorText)
  ) {
    const previousModel = String(payload.model ?? "");
    cachedDeepSeekModel = null;
    cachedDeepSeekModelExpiresAt = 0;

    const refreshedModel = await resolveDeepSeekModel(true, signal);
    if (refreshedModel !== previousModel) {
      return sendDeepSeekRequest(
        { ...payload, model: refreshedModel },
        false,
        signal,
      );
    }
  }

  throw new Error(
    `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
  );
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

async function invokeLLMRequest(params: InvokeParams, signal?: AbortSignal): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: await resolveDeepSeekModel(false, signal),
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = params.maxTokens ?? params.max_tokens ?? 32768;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  signal?.throwIfAborted();
  return sendDeepSeekRequest(payload, true, signal);
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (params.timeoutMs === undefined) return invokeLLMRequest(params);
  const timeoutMs = params.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive finite number");
  }
  const controller = new AbortController();
  const timeoutError = new Error(`LLM request timed out after ${timeoutMs}ms`);
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  try {
    return await invokeLLMRequest(params, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw timeoutError;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
