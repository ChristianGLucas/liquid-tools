// package: christiangeorgelucas.liquid_tools
// file: messages.proto

import * as jspb from "google-protobuf";

export class LiquidError extends jspb.Message {
  getKind(): string;
  setKind(value: string): void;

  getMessage(): string;
  setMessage(value: string): void;

  getLine(): number;
  setLine(value: number): void;

  getCol(): number;
  setCol(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidError.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidError): LiquidError.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidError, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidError;
  static deserializeBinaryFromReader(message: LiquidError, reader: jspb.BinaryReader): LiquidError;
}

export namespace LiquidError {
  export type AsObject = {
    kind: string,
    message: string,
    line: number,
    col: number,
  }
}

export class LiquidRenderRequest extends jspb.Message {
  getTemplate(): string;
  setTemplate(value: string): void;

  getDataJson(): string;
  setDataJson(value: string): void;

  getPartialsMap(): jspb.Map<string, string>;
  clearPartialsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidRenderRequest.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidRenderRequest): LiquidRenderRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidRenderRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidRenderRequest;
  static deserializeBinaryFromReader(message: LiquidRenderRequest, reader: jspb.BinaryReader): LiquidRenderRequest;
}

export namespace LiquidRenderRequest {
  export type AsObject = {
    template: string,
    dataJson: string,
    partialsMap: Array<[string, string]>,
  }
}

export class LiquidRenderResult extends jspb.Message {
  getOk(): boolean;
  setOk(value: boolean): void;

  getOutput(): string;
  setOutput(value: string): void;

  hasError(): boolean;
  clearError(): void;
  getError(): LiquidError | undefined;
  setError(value?: LiquidError): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidRenderResult.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidRenderResult): LiquidRenderResult.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidRenderResult, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidRenderResult;
  static deserializeBinaryFromReader(message: LiquidRenderResult, reader: jspb.BinaryReader): LiquidRenderResult;
}

export namespace LiquidRenderResult {
  export type AsObject = {
    ok: boolean,
    output: string,
    error?: LiquidError.AsObject,
  }
}

export class LiquidRenderInLayoutRequest extends jspb.Message {
  getContentTemplate(): string;
  setContentTemplate(value: string): void;

  getLayoutName(): string;
  setLayoutName(value: string): void;

  getDataJson(): string;
  setDataJson(value: string): void;

  getPartialsMap(): jspb.Map<string, string>;
  clearPartialsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidRenderInLayoutRequest.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidRenderInLayoutRequest): LiquidRenderInLayoutRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidRenderInLayoutRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidRenderInLayoutRequest;
  static deserializeBinaryFromReader(message: LiquidRenderInLayoutRequest, reader: jspb.BinaryReader): LiquidRenderInLayoutRequest;
}

export namespace LiquidRenderInLayoutRequest {
  export type AsObject = {
    contentTemplate: string,
    layoutName: string,
    dataJson: string,
    partialsMap: Array<[string, string]>,
  }
}

export class LiquidVariableRef extends jspb.Message {
  clearSegmentsList(): void;
  getSegmentsList(): Array<string>;
  setSegmentsList(value: Array<string>): void;
  addSegments(value: string, index?: number): string;

  getLine(): number;
  setLine(value: number): void;

  getCol(): number;
  setCol(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidVariableRef.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidVariableRef): LiquidVariableRef.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidVariableRef, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidVariableRef;
  static deserializeBinaryFromReader(message: LiquidVariableRef, reader: jspb.BinaryReader): LiquidVariableRef;
}

export namespace LiquidVariableRef {
  export type AsObject = {
    segmentsList: Array<string>,
    line: number,
    col: number,
  }
}

export class LiquidTemplateRequest extends jspb.Message {
  getTemplate(): string;
  setTemplate(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidTemplateRequest.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidTemplateRequest): LiquidTemplateRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidTemplateRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidTemplateRequest;
  static deserializeBinaryFromReader(message: LiquidTemplateRequest, reader: jspb.BinaryReader): LiquidTemplateRequest;
}

export namespace LiquidTemplateRequest {
  export type AsObject = {
    template: string,
  }
}

export class LiquidVariablesResult extends jspb.Message {
  getOk(): boolean;
  setOk(value: boolean): void;

  clearVariablesList(): void;
  getVariablesList(): Array<LiquidVariableRef>;
  setVariablesList(value: Array<LiquidVariableRef>): void;
  addVariables(value?: LiquidVariableRef, index?: number): LiquidVariableRef;

  clearGlobalsList(): void;
  getGlobalsList(): Array<LiquidVariableRef>;
  setGlobalsList(value: Array<LiquidVariableRef>): void;
  addGlobals(value?: LiquidVariableRef, index?: number): LiquidVariableRef;

  clearLocalsList(): void;
  getLocalsList(): Array<string>;
  setLocalsList(value: Array<string>): void;
  addLocals(value: string, index?: number): string;

  clearTagsList(): void;
  getTagsList(): Array<string>;
  setTagsList(value: Array<string>): void;
  addTags(value: string, index?: number): string;

  clearFiltersList(): void;
  getFiltersList(): Array<string>;
  setFiltersList(value: Array<string>): void;
  addFilters(value: string, index?: number): string;

  hasError(): boolean;
  clearError(): void;
  getError(): LiquidError | undefined;
  setError(value?: LiquidError): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidVariablesResult.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidVariablesResult): LiquidVariablesResult.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidVariablesResult, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidVariablesResult;
  static deserializeBinaryFromReader(message: LiquidVariablesResult, reader: jspb.BinaryReader): LiquidVariablesResult;
}

export namespace LiquidVariablesResult {
  export type AsObject = {
    ok: boolean,
    variablesList: Array<LiquidVariableRef.AsObject>,
    globalsList: Array<LiquidVariableRef.AsObject>,
    localsList: Array<string>,
    tagsList: Array<string>,
    filtersList: Array<string>,
    error?: LiquidError.AsObject,
  }
}

export class LiquidValidateResult extends jspb.Message {
  getValid(): boolean;
  setValid(value: boolean): void;

  hasError(): boolean;
  clearError(): void;
  getError(): LiquidError | undefined;
  setError(value?: LiquidError): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LiquidValidateResult.AsObject;
  static toObject(includeInstance: boolean, msg: LiquidValidateResult): LiquidValidateResult.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LiquidValidateResult, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LiquidValidateResult;
  static deserializeBinaryFromReader(message: LiquidValidateResult, reader: jspb.BinaryReader): LiquidValidateResult;
}

export namespace LiquidValidateResult {
  export type AsObject = {
    valid: boolean,
    error?: LiquidError.AsObject,
  }
}

