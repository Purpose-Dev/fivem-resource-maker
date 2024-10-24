#!/usr/bin/env node
import inquirer from 'inquirer';
import * as url from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
import { SingleBar } from "cli-progress";
import chalk from "chalk";
import { execSync } from "child_process";

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

function initializeProject(destinationPath, packageManager, buildTool) {
    try {
        const command = packageManager === 'npm' ? `${packageManager} init -y` : `${packageManager.toString()} init`;
        execSync(command, { cwd: destinationPath, stdio: 'inherit' });


        if (buildTool) {
            const buildToolDependencies = {
                esbuild: 'esbuild',
                tsc: 'typescript',
                webpack: 'webpack webpack-cli',
                rollup: 'rollup',
            };

            const buildToolDep = buildToolDependencies[buildTool] ? buildToolDependencies[buildTool] : '';
            const installCommand = `${packageManager} install @citizenfx/server @citizenfx/client ${buildToolDep}`.trim();

            execSync(installCommand, { cwd: destinationPath, stdio: 'inherit' });
        }

        console.info(chalk.green(`Project initialized successfully with ${packageManager}`));
    } catch (error) {
        console.error(chalk.red(`Failed to initialize project with ${packageManager}: ${error.message}`));
    }
}

function copyBuildToolConfig(tsBuildTool, templatePath, destinationPath) {
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

inquirer.prompt(questions).then(answers => {
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

    const fxmanifestTemplate = fs.readFileSync(path.join(templatePath, 'fxmanifest.lua'), 'utf8')
        .replace('%AUTHOR%', author)
        .replace('%DESCRIPTION%', description);
    fs.writeFileSync(path.join(destinationPath, 'fxmanifest.lua'), fxmanifestTemplate);

    const initializeLanguageSpecifics = async () => {

        switch (language) {
            case 'JavaScript':
                copyDirectory(path.join(templatePath, 'client'), path.join(destinationPath, 'client'));
                copyDirectory(path.join(templatePath, 'server'), path.join(destinationPath, 'server'));
                const { packageManager } = await inquirer.prompt(packageManagerOptions);
                initializeProject(destinationPath, packageManager, null);
                break;
            case 'TypeScript':
                copyDirectory(path.join(templatePath, 'src', 'client'), path.join(destinationPath, 'src', 'client'));
                copyDirectory(path.join(templatePath, 'src', 'server'), path.join(destinationPath, 'src', 'server'));
                const { packageManagerTs } = await inquirer.prompt(packageManagerOptions);
                const { tsBuildTool } = await inquirer.prompt(tsBuildToolOptions);
                initializeProject(destinationPath, packageManagerTs, tsBuildTool);
                copyBuildToolConfig(tsBuildTool, templatePath, destinationPath);
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
    };

    void initializeLanguageSpecifics();
});
