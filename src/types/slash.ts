export type SlashCommandCategory = "markdown" | "review" | "shortcut" | "agent";

export type SlashMenuState = {
  visible: boolean;
  query: string;
  slashFrom: number;
  slashTo: number;
  rect: { top: number; left: number; bottom: number } | null;
};

export type SlashExecuteContext = {
  slashFrom: number;
  slashTo: number;
};

export type SlashMarkdownCommand = {
  category: "markdown" | "shortcut";
  hint: string;
  id: string;
  insertText: string;
  label: string;
  searchKeys: readonly string[];
};

export type SlashActionCommand = {
  action: () => void;
  category: "review" | "agent";
  hint: string;
  id: string;
  label: string;
  searchKeys: readonly string[];
};

export type SlashCommand = SlashMarkdownCommand | SlashActionCommand;

export const HIDDEN_SLASH_STATE: SlashMenuState = {
  rect: null,
  slashFrom: 0,
  slashTo: 0,
  visible: false,
  query: "",
};
