#!/usr/bin/env node
import inquirer from 'inquirer';
import * as url from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
import { SingleBar } from "cli-progress";
import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";

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
    }
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

let bar;

function startProgressBar(totalFiles) {
    bar = new SingleBar({}, { format: 'Copying | {bar} | {percentage}% | {value}/{total} files' });
    bar.start(totalFiles, 0);
}

function stopProgressBar() {
    if (bar) {
        bar.stop();
    }
}

function copyFile(sourcePath, destinationPath) {
    fs.copyFileSync(sourcePath, destinationPath);
    bar.increment();
}

function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);
    startProgressBar(files.length);

    files.forEach(file => {
        const sourcePath = path.join(source, file);
        const destinationPath = path.join(destination, file);

        if (fs.statSync(sourcePath).isDirectory()) {
            copyDirectory(sourcePath, destinationPath);
        } else {
            copyFile(sourcePath, destinationPath);
        }
    });

    stopProgressBar();
}

async function initializeProject(destinationPath, packageManager, buildTool) {
    try {
        const command = packageManager === 'npm' ? `${packageManager} init -y` : `${packageManager} init`;
        await execAsync(command);

        if (buildTool) {
            const buildToolDependencies = {
                esbuild: 'esbuild',
                tsc: 'typescript',
                webpack: 'webpack webpack-cli',
                rollup: 'rollup rollup-plugin-terser @rollup/plugin-node-resolve @rollup/plugin-commonjs',
            };

            const buildToolDep = buildToolDependencies[buildTool] ? buildToolDependencies[buildTool] : '';
            const installCommand = `${packageManager} add -D ${buildToolDep}`.trim();

            await execAsync(installCommand);
        }

        await execAsync(`${packageManager} add -D @citizenfx/server @citizenfx/client`);
        console.info(chalk.green(`Project initialized successfully with ${packageManager}`));
    } catch (error) {
        console.error(chalk.red(`Failed to initialize project with ${packageManager}: ${error.message}`));
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
            copyFile(path.join(templatePath, configFile), path.join(destinationPath, configFile));
            console.info(chalk.blue(`${tsBuildTool} configuration file copied.`));
        } catch (error) {
            console.error(chalk.red(`Error copying ${tsBuildTool} configuration file: ${error.message}`));
        }
    } else {
        console.error(chalk.red("Unsupported build tool."));
    }
}

async function main() {
    const answers = await inquirer.prompt(questions);
    const { language, resourceName, author, description } = answers;
    const languageFolderMap = {
        Lua: 'lua',
        JavaScript: 'js',
        TypeScript: 'ts',
    };

    const templatePath = path.join(__dirname, 'templates', languageFolderMap[language]);
    const destinationPath = path.join(process.cwd(), resourceName);

    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath);
    }

    let fxmanifestTemplate = fs.readFileSync(path.join(templatePath, 'fxmanifest.lua'), 'utf8')
        .replace('%AUTHOR%', author)
        .replace('%DESCRIPTION%', description);

    if (language === 'Lua') {
        const { lua54 } = await inquirer.prompt(luaOptions);
        if (lua54) {
            fxmanifestTemplate = fxmanifestTemplate.replace('%LUA54%', 'yes');
        } else {
            fxmanifestTemplate = fxmanifestTemplate.replace(/^\s*lua54.*(\r?\n)?/gm, '');
        }
    }

    fs.writeFileSync(path.join(destinationPath, 'fxmanifest.lua'), fxmanifestTemplate);

    switch (language) {
        case 'JavaScript':
            copyDirectory(path.join(templatePath, 'client'), path.join(destinationPath, 'client'));
            copyDirectory(path.join(templatePath, 'server'), path.join(destinationPath, 'server'));
            const { packageManager } = await inquirer.prompt(packageManagerOptions);
            await initializeProject(destinationPath, packageManager, null);
            break;
        case 'TypeScript':
            copyDirectory(path.join(templatePath, 'src', 'client'), path.join(destinationPath, 'src', 'client'));
            copyDirectory(path.join(templatePath, 'src', 'server'), path.join(destinationPath, 'src', 'server'));
            const { packageManagerTs } = await inquirer.prompt(packageManagerOptions);
            const { tsBuildTool } = await inquirer.prompt(tsBuildToolOptions);
            await initializeProject(destinationPath, packageManagerTs, tsBuildTool);
            await copyBuildToolConfig(tsBuildTool, templatePath, destinationPath);
            break;
        case 'Lua':
            copyDirectory(path.join(templatePath, 'client'), path.join(destinationPath, 'client'));
            copyDirectory(path.join(templatePath, 'server'), path.join(destinationPath, 'server'));
            break;
        default:
            console.error(chalk.red("Unsupported language."));
            return;
    }
    console.info(chalk.green(`Resource ${resourceName} created successfully in ${destinationPath}`));
}

main()
    .catch(console.error);
