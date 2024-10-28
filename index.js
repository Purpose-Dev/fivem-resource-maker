#!/usr/bin/env node
import inquirer from 'inquirer';
import * as url from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questions = [
    {
        type: 'list',
        name: 'language',
        message: 'Select language for resource',
        choices: ['Lua', 'JavaScript', 'TypeScript'],
    },
    {
        type: 'input',
        name: 'resourceName',
        message: 'Enter the resource name:',
    },
    {
        type: 'input',
        name: 'author',
        message: 'Enter the author name:',
    },
    {
        type: 'input',
        name: 'description',
        message: 'Enter the description of resource:',
    },
    {
        type: 'confirm',
        name: 'nuiUsage',
        message: 'Do you want to use NUI?',
        default: false,
    },
];

const luaOptions = {
    type: 'confirm',
    name: 'lua54',
    message: 'Do you want to use Lua 5.4?',
    default: true,
};

const packageManagerOptions = {
    type: 'list',
    name: 'packageManager',
    message: 'Choose a package manager',
    choices: ['npm', 'yarn', 'pnpm'],
};

const tsBuildToolOptions = {
    type: 'list',
    name: 'tsBuildTool',
    message: 'Choose a TypeScript build tool',
    choices: ['esbuild', 'tsc', 'webpack', 'rollup'],
};

const nuiOptions = [
    {
        type: 'list',
        name: 'nuiType',
        message: 'Select a framework or library for your nui:',
        choices: ['vanilla', 'react', 'vue', 'svelte', 'angular'],
    },
    {
        type: 'list',
        name: 'cssFramework',
        message: 'Select a CSS framework for your nui:',
        choices: ['none', 'bootstrap', 'tailwind', 'sass', 'less'],
    },
    {
        type: 'list',
        name: 'language',
        message: 'Select a language for your nui:',
        choices: ['JavaScript', 'TypeScript'],
    },
];

function copyFile(sourcePath, destinationPath) {
    fs.copyFileSync(sourcePath, destinationPath);
}

function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);

    files.forEach((file) => {
        const sourcePath = path.join(source, file);
        const destinationPath = path.join(destination, file);

        if (fs.statSync(sourcePath).isDirectory()) {
            copyDirectory(sourcePath, destinationPath);
        } else {
            copyFile(sourcePath, destinationPath);
        }
    });
}

async function initializeProject(destinationPath, packageManager, buildTool) {
    try {
        const command =
            packageManager === 'npm'
                ? `${packageManager} init -y`
                : `${packageManager} init`;
        console.log(chalk.blue('📦  Initializing project...'));
        process.chdir(destinationPath);
        console.log(
            chalk.blue(`🔧  Changed working directory to ${destinationPath}`)
        );
        await execAsync(command);

        if (buildTool) {
            const buildToolDependencies = {
                esbuild: 'esbuild',
                tsc: 'typescript',
                webpack: 'webpack webpack-cli ts-loader',
                rollup: 'rollup rollup-plugin-terser @rollup/plugin-node-resolve @rollup/plugin-commonjs',
            };

            const buildToolDep = buildToolDependencies[buildTool]
                ? buildToolDependencies[buildTool]
                : '';
            const installCommand =
                `${packageManager} add -D ${buildToolDep}`.trim();
            console.log(
                chalk.blue('🔧  Installing build tool dependencies...')
            );
            await execAsync(installCommand);
        }

        console.log(chalk.blue('📦  Installing CitizenFX dependencies...'));
        await execAsync(
            `${packageManager} add -D @citizenfx/server @citizenfx/client`
        );
        console.info(
            chalk.green(
                `✅  Project initialized successfully with ${packageManager}`
            )
        );
    } catch (error) {
        console.error(
            chalk.red(
                `❌  Failed to initialize project with ${packageManager}: ${error.message}`
            )
        );
    }
}

async function copyBuildToolConfig(tsBuildTool, templatePath, destinationPath) {
    const configFiles = {
        esbuild: 'esbuild.config.js',
        tsc: 'tsconfig.json',
        webpack: 'webpack.config.js',
        rollup: 'rollup.config.js',
    };

    const configFile = configFiles[tsBuildTool];
    if (configFile) {
        try {
            copyFile(
                path.join(templatePath, configFile),
                path.join(destinationPath, configFile)
            );
            console.info(
                chalk.blue(`${tsBuildTool} configuration file copied.`)
            );
        } catch (error) {
            console.error(
                chalk.red(
                    `Error copying ${tsBuildTool} configuration file: ${error.message}`
                )
            );
        }
    } else {
        console.error(chalk.red('Unsupported build tool.'));
    }
}

async function nuiUsage() {
    const answers = await inquirer.prompt(nuiOptions);
    const { nuiType, cssFramework, language } = answers;
}

async function main() {
    const answers = await inquirer.prompt(questions);
    const { language, resourceName, author, description, nuiUsage } = answers;
    const languageFolderMap = {
        Lua: 'lua',
        JavaScript: 'js',
        TypeScript: 'ts',
    };

    const templatePath = path.join(
        __dirname,
        'templates',
        languageFolderMap[language]
    );
    const destinationPath = path.join(process.cwd(), resourceName);

    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath);
    }

    let fxmanifestTemplate = fs
        .readFileSync(path.join(templatePath, 'fxmanifest.lua'), 'utf8')
        .replace('%AUTHOR%', author)
        .replace('%DESCRIPTION%', description);

    if (language === 'Lua') {
        const { lua54 } = await inquirer.prompt(luaOptions);
        if (lua54) {
            fxmanifestTemplate = fxmanifestTemplate.replace('%LUA54%', 'yes');
        } else {
            fxmanifestTemplate = fxmanifestTemplate.replace(
                /^\s*lua54.*(\r?\n)?/gm,
                ''
            );
        }
    }

    fs.writeFileSync(
        path.join(destinationPath, 'fxmanifest.lua'),
        fxmanifestTemplate
    );

    switch (language) {
        case 'JavaScript':
            copyDirectory(
                path.join(templatePath, 'client'),
                path.join(destinationPath, 'client')
            );
            copyDirectory(
                path.join(templatePath, 'server'),
                path.join(destinationPath, 'server')
            );
            const { packageManager: pmJs } = await inquirer.prompt(
                packageManagerOptions
            );
            await initializeProject(destinationPath, pmJs, null);
            break;
        case 'TypeScript':
            copyDirectory(
                path.join(templatePath, 'src', 'client'),
                path.join(destinationPath, 'src', 'client')
            );
            copyDirectory(
                path.join(templatePath, 'src', 'server'),
                path.join(destinationPath, 'src', 'server')
            );
            const { packageManager: pmTs } = await inquirer.prompt(
                packageManagerOptions
            );
            const { tsBuildTool } = await inquirer.prompt(tsBuildToolOptions);
            await initializeProject(destinationPath, pmTs, tsBuildTool);
            await copyBuildToolConfig(
                tsBuildTool,
                templatePath,
                destinationPath
            );
            break;
        case 'Lua':
            copyDirectory(
                path.join(templatePath, 'client'),
                path.join(destinationPath, 'client')
            );
            copyDirectory(
                path.join(templatePath, 'server'),
                path.join(destinationPath, 'server')
            );
            break;
        default:
            console.error(chalk.red('Unsupported language.'));
            return;
    }

    console.info(
        chalk.green(
            `🌟 Resource ${resourceName} created successfully in ${destinationPath}`
        )
    );
}

main().catch(console.error);
