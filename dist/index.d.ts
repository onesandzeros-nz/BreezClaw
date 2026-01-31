interface PluginApi {
    registerTool(tool: ToolDefinition, options?: {
        optional?: boolean;
    }): void;
    registerService(service: ServiceDefinition): void;
    config: PluginConfig;
    logger: Logger;
}
interface ToolDefinition {
    name: string;
    description: string;
    parameters: unknown;
    execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>;
}
interface ServiceDefinition {
    id: string;
    start: () => void | Promise<void>;
    stop: () => void | Promise<void>;
}
interface ToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
interface PluginConfig {
    breezApiKey?: string;
    network?: 'mainnet' | 'testnet';
}
interface Logger {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
}
export declare function register(api: PluginApi): void;
export declare const activate: typeof register;
export {};
//# sourceMappingURL=index.d.ts.map