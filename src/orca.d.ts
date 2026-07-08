// Orca Note API Type Definitions
// Based on official orca-simple-task reference plugin

export type DbId = number

export type ContentFragment = {
  t: string // type
  v: any // value
  f?: string // format
  fa?: Record<string, any> // format arguments
  color?: string // highlight color (for bc/fc types)
  [key: string]: any
}

export interface Block {
  id: DbId
  content?: ContentFragment[]
  text?: string
  _repr?: {
    content?: ContentFragment[]
    src?: string
    url?: string
    image?: string
    [k: string]: any
  }
  created: Date
  modified: Date
  parent?: DbId
  left?: DbId
  children: DbId[]
  aliases: string[]
  properties: BlockProperty[]
  refs: BlockRef[]
  backRefs: BlockRef[]
}

export interface BlockProperty {
  name: string
  type: number
  typeArgs?: any
  value?: any
  pos?: number
}

export interface BlockRef {
  id: DbId
  from: DbId
  to: DbId
  type: number
  alias?: string
  data?: BlockProperty[]
}

// Panels
export type PanelView = 'journal' | 'block'

export interface RowPanel {
  id: string
  direction: 'row'
  children: (ColumnPanel | ViewPanel)[]
  height: number
}

export interface ColumnPanel {
  id: string
  direction: 'column'
  children: (RowPanel | ViewPanel)[]
  width: number
}

export interface ViewPanel {
  id: string
  view: PanelView
  viewArgs?: Record<string, any>
  viewState: Record<string, any>
  width?: number
  height?: number
  locked?: boolean
  wide?: boolean
}

export interface CursorNodeData {
  blockId: DbId
  isInline: boolean
  index: number
  offset: number
}

export interface CursorData {
  anchor: CursorNodeData
  focus: CursorNodeData
  isForward: boolean
}

export type EditorArg = [
  string, // panelId
  DbId, // rootBlockId
  CursorData, // cursor
  boolean, // isRedo
]

export interface ToolbarButton {
  icon: string
  tooltip: string
  command: string
  color?: string
  background?: string
}

export interface SlashCommand {
  icon: string
  group: string
  title: string
  command: string
}

export interface PluginSettingsSchema {
  [key: string]: {
    label: string
    description?: string
    type:
      | 'string'
      | 'number'
      | 'boolean'
      | 'date'
      | 'time'
      | 'datetime'
      | 'dateRange'
      | 'datetimeRange'
      | 'color'
      | 'singleChoice'
      | 'multiChoices'
      | 'array'
    defaultValue?: any
    choices?: { label: string; value: string }[]
    arrayItemSchema?: PluginSettingsSchema
  }
}

export interface Plugin {
  enabled: boolean
  icon: string
  schema?: PluginSettingsSchema
  settings?: Record<string, any>
  module?: any
}

export interface OrcaAPI {
  invokeBackend: (type: string, ...args: any[]) => Promise<any>
  /** 已知后端 API 调用（类型提示） */
  invokeBackendKnown?: {
    /** add-block: 在父块下添加子块 (parentId, content) => newBlockId */
    'add-block': (parentId: DbId, content: ContentFragment[]) => Promise<DbId>
    /** set-block-data: 设置块元数据 (blockId, data) => void */
    'set-block-data': (blockId: DbId, data: Record<string, any>) => Promise<void>
    /** move-block-after: 将块移动到另一块之后 (blockId, targetBlockId) => void */
    'move-block-after': (blockId: DbId, targetBlockId: DbId) => Promise<void>
    /** move-block: 移动块到新父块下 (blockId, newParentId, position) => void */
    'move-block': (blockId: DbId, newParentId: DbId, position: 'first' | 'last' | number) => Promise<void>
    /** fold-block: 折叠/展开块 (blockId, fold) => void */
    'fold-block': (blockId: DbId, fold: boolean) => Promise<void>
  }
  state: {
    activePanel: string
    blocks: Record<string | DbId, Block>
    commands: Record<string, any>
    dataDir: string
    locale: string
    notifications: any[]
    panels: RowPanel
    plugins: Record<string, Plugin>
    repo: string
    settings: Record<number, any>
    shortcuts: Record<string, string>
    themeMode: 'light' | 'dark'
    themes: Record<string, string>
    toolbarButtons: Record<string, ToolbarButton | ToolbarButton[]>
    slashCommands: Record<string, any>
    blockMenuCommands: Record<string, any>
    tagMenuCommands: Record<string, any>
  }
  commands: {
    registerCommand: (id: string, fn: (...args: any[]) => void | Promise<void>, label?: string) => void
    unregisterCommand: (id: string) => void
    registerEditorCommand: (
      id: string,
      doFn: (editor: EditorArg, ...args: any[]) => any,
      undoFn: (...args: any[]) => void | Promise<void>,
      opts?: { label?: string; hasArgs?: boolean; noFocusNeeded?: boolean },
    ) => void
    unregisterEditorCommand: (id: string) => void
    invokeCommand: (id: string, ...args: any[]) => Promise<any>
    invokeEditorCommand: (id: string, cursor: CursorData | null, ...args: any[]) => Promise<any>
    invokeGroup: (callback: () => Promise<void>) => Promise<void>
  }
  shortcuts: {
    reload: () => Promise<void>
    assign: (shortcut: string, command: string) => Promise<void>
    reset: (command: string) => Promise<void>
  }
  nav: {
    goTo: (view: PanelView, viewArgs?: Record<string, any>, panelId?: string) => void
    openInLastPanel: (view: PanelView, viewArgs?: Record<string, any>) => void
    findViewPanel: (id: string, panels: RowPanel) => ViewPanel | null
    switchFocusTo: (id: string) => void
  }
  plugins: {
    setSettingsSchema: (name: string, schema: PluginSettingsSchema) => Promise<void>
    setSettings: (to: 'app' | 'repo', name: string, settings: Record<string, any>) => Promise<void>
    getData: (name: string, key: string) => Promise<any>
    setData: (name: string, key: string, value: string | number | ArrayBuffer | null) => Promise<void>
    removeData: (name: string, key: string) => Promise<void>
  }
  renderers: {
    registerBlock: (type: string, isEditable: boolean, renderer: any) => void
    unregisterBlock: (type: string) => void
    registerInline: (type: string, isEditable: boolean, renderer: any) => void
    unregisterInline: (type: string) => void
  }
  converters: {
    registerBlock: (format: string, type: string, fn: any) => void
    unregisterBlock: (format: string, type: string) => void
    registerInline: (format: string, type: string, fn: any) => void
    unregisterInline: (format: string, type: string) => void
  }
  toolbar: {
    registerToolbarButton: (id: string, button: ToolbarButton | ToolbarButton[]) => void
    unregisterToolbarButton: (id: string) => void
  }
  slashCommands: {
    registerSlashCommand: (id: string, command: SlashCommand) => void
    unregisterSlashCommand: (id: string) => void
  }
  headbar: {
    registerHeadbarButton: (id: string, renderer: () => any) => void
    unregisterHeadbarButton: (id: string) => void
  }
  components: {
    ModalOverlay: any
    InputBox: any
    ConfirmBox: any
    Button: any
    Input: any
    Select: any
    Checkbox: any
    Switch: any
    Tooltip: any
    [key: string]: any
  }
  notify: (
    type: 'info' | 'success' | 'warn' | 'error',
    message: string,
    options?: { title?: string; action?: () => void | Promise<void> },
  ) => void
}

declare global {
  const orca: OrcaAPI
  interface Window {
    orca: OrcaAPI
    React: any
    ReactDOM: any
    Valtio: any
  }
}

export {}
