/**
 * Typed messaging between Content Script and Background Service Worker
 */

import type { ChatMessage, PageContext } from "./types";
import type { StructuredPageIntelligence } from "../page-intelligence/types";

export const MessageActions = {
  PING: "BROWSY_PING",
  PONG: "BROWSY_PONG",
  GET_PAGE_CONTEXT: "BROWSY_GET_PAGE_CONTEXT",
  PAGE_CONTEXT_RESPONSE: "BROWSY_PAGE_CONTEXT_RESPONSE",
  OPEN_ASSISTANT: "BROWSY_OPEN_ASSISTANT",
  CLOSE_ASSISTANT: "BROWSY_CLOSE_ASSISTANT",
  USER_REQUEST: "BROWSY_USER_REQUEST",
  ASSISTANT_RESPONSE: "BROWSY_ASSISTANT_RESPONSE",
  GET_PAGE_INTELLIGENCE: "BROWSY_GET_PAGE_INTELLIGENCE",
  PAGE_INTELLIGENCE_RESPONSE: "BROWSY_PAGE_INTELLIGENCE_RESPONSE",
  REFRESH_PAGE_INTELLIGENCE: "BROWSY_REFRESH_PAGE_INTELLIGENCE",
  GET_ELEMENT_DETAILS: "BROWSY_GET_ELEMENT_DETAILS",
  AI_STATUS: "BROWSY_AI_STATUS",
  AI_QUERY: "BROWSY_AI_QUERY",
  AI_SELECT_MODEL: "BROWSY_AI_SELECT_MODEL",
} as const;

export type MessageAction = (typeof MessageActions)[keyof typeof MessageActions];

export interface BaseMessage {
  action: MessageAction;
  timestamp: number;
}

export interface PingMessage extends BaseMessage {
  action: typeof MessageActions.PING;
}

export interface PongMessage extends BaseMessage {
  action: typeof MessageActions.PONG;
  version: string;
}

export interface GetPageContextMessage extends BaseMessage {
  action: typeof MessageActions.GET_PAGE_CONTEXT;
}

export interface PageContextResponseMessage extends BaseMessage {
  action: typeof MessageActions.PAGE_CONTEXT_RESPONSE;
  context: PageContext;
}

export interface OpenAssistantMessage extends BaseMessage {
  action: typeof MessageActions.OPEN_ASSISTANT;
}

export interface CloseAssistantMessage extends BaseMessage {
  action: typeof MessageActions.CLOSE_ASSISTANT;
}

export interface UserRequestMessage extends BaseMessage {
  action: typeof MessageActions.USER_REQUEST;
  prompt: string;
  context: PageContext;
}

export interface AssistantResponseMessage extends BaseMessage {
  action: typeof MessageActions.ASSISTANT_RESPONSE;
  message: ChatMessage;
}

export interface GetPageIntelligenceMessage extends BaseMessage {
  action: typeof MessageActions.GET_PAGE_INTELLIGENCE;
}

export interface PageIntelligenceResponseMessage extends BaseMessage {
  action: typeof MessageActions.PAGE_INTELLIGENCE_RESPONSE;
  intelligence: StructuredPageIntelligence;
}

export interface RefreshPageIntelligenceMessage extends BaseMessage {
  action: typeof MessageActions.REFRESH_PAGE_INTELLIGENCE;
}

export interface GetElementDetailsMessage extends BaseMessage {
  action: typeof MessageActions.GET_ELEMENT_DETAILS;
  elementId: string;
}

export interface AIStatusMessage extends BaseMessage {
  action: typeof MessageActions.AI_STATUS;
}

export interface AIQueryMessage extends BaseMessage {
  action: typeof MessageActions.AI_QUERY;
  endpoint: string;
  payload: any;
  timeoutMs?: number;
  simulate?: string;
}

export interface AISelectModelMessage extends BaseMessage {
  action: typeof MessageActions.AI_SELECT_MODEL;
  model: string;
}

export type ExtensionMessage =
  | PingMessage
  | PongMessage
  | GetPageContextMessage
  | PageContextResponseMessage
  | OpenAssistantMessage
  | CloseAssistantMessage
  | UserRequestMessage
  | AssistantResponseMessage
  | GetPageIntelligenceMessage
  | PageIntelligenceResponseMessage
  | RefreshPageIntelligenceMessage
  | GetElementDetailsMessage
  | AIStatusMessage
  | AIQueryMessage
  | AISelectModelMessage;
