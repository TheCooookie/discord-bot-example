import { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

/**
 * @interface BotCommand
 * @description Represents the structure of a Discord bot command.
 * This interface defines the necessary properties for a command to be registered and executed by the bot.
 */
export interface BotCommand {
    /**
     * The data for the slash command, used to register it with Discord.
     * It can be a `SlashCommandBuilder` instance (without subcommand methods) or a plain object with `name` and `toJSON` method.
     * @type {Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | { name: string; toJSON: () => any; }}
     */
    data: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | { name: string; toJSON: () => any; };
    /**
     * The function to execute when the command is called by a user.
     * It receives the `ChatInputCommandInteraction` object.
     * @param {ChatInputCommandInteraction} interaction The interaction object representing the command invocation.
     * @returns {Promise<void>} A promise that resolves when the command execution is complete.
     */
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

declare module 'discord.js' {
  /**
   * Extends the `Client` interface from `discord.js` to include a `commands` property.
   * This allows the bot's client instance to directly manage its registered commands.
   * @interface Client
   * @extends {import('discord.js').Client}
   */
  export interface Client {
    /**
     * A collection of registered bot commands, where the key is the command name and the value is the `BotCommand` object.
     * @type {Collection<string, BotCommand>}
     */
    commands: Collection<string, BotCommand>;
  }
}