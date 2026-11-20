import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Collection,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    SlashCommandBuilder,
} from 'discord.js';

/** Shape every file in src/commands must default-export. */
export interface BotCommand {
    /** Command definition sent to Discord. */
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | { name: string; toJSON: () => any; };
    /** Runs when a user calls the command. */
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    /** Suggests values for options declared with `.setAutocomplete(true)`. */
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/** Shape every file in src/components must default-export: handles buttons, select menus and modals. */
export interface BotComponent {
    /** Handles every interaction whose customId is this, or starts with `this:` (e.g. 'announce' handles 'announce:ack'). */
    customId: string;
    execute: (interaction: MessageComponentInteraction | ModalSubmitInteraction) => Promise<void>;
}

declare module 'discord.js' {
  export interface Client {
    /** Loaded commands, keyed by command name. */
    commands: Collection<string, BotCommand>;
    /** Loaded component handlers, keyed by customId prefix. */
    components: Collection<string, BotComponent>;
  }
}
