import { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

/** Shape every file in src/commands must default-export. */
export interface BotCommand {
    /** Command definition sent to Discord. */
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | { name: string; toJSON: () => any; };
    /** Runs when a user calls the command. */
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

declare module 'discord.js' {
  export interface Client {
    /** Loaded commands, keyed by command name. */
    commands: Collection<string, BotCommand>;
  }
}
