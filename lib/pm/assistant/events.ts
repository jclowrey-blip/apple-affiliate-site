/** One line of the assistant endpoint's newline-delimited JSON response. */
export type AssistantEvent =
  | { type: "tool"; label: string } // a tool call started
  | { type: "final"; text: string; mutated: boolean } // the reply; mutated = data was changed
  | { type: "error"; message: string };
