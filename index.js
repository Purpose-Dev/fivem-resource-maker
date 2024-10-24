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
}

function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);
    const bar = new SingleBar({}, { format: 'Copying | {bar} | {percentage}% | {value}/{total} files' });

    bar.start(files.length, 0);

    files.forEach(file => {
        const sourcePath = path.join(source, file);
        const destinationPath = path.join(destination, file);

        if (fs.statSync(sourcePath).isDirectory()) {
            copyDirectory(sourcePath, destinationPath);
        } else {
            fs.copyFileSync(sourcePath, destinationPath);
        }

        bar.increment();
    });

    bar.stop();
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

    switch (language) {
        case 'JavaScript':
            copyDirectory(path.join(templatePath, 'client'), path.join(destinationPath, 'client'));
            copyDirectory(path.join(templatePath, 'server'), path.join(destinationPath, 'server'));

            inquirer.prompt(packageManagerOptions).then(pmAnswer => {
                const { packageManager } = pmAnswer;

                try {
                    if (packageManager === 'npm') {
                        execSync(`${packageManager} init -y`, { cwd: destinationPath, stdio: 'inherit' });
                    } else {
                        execSync(`${packageManager} init`, { cwd: destinationPath, stdio: 'inherit' });
                    }

                    console.info(chalk.green(`Project initialized successfully with ${packageManager}`));
                } catch (error) {
                    console.error(chalk.red(`Failed to initialize project with ${packageManager}: ${error.message}`));
                }
            });
            break;
        case 'TypeScript':
            copyDirectory(path.join(templatePath, 'src', 'client'), path.join(destinationPath, 'src', 'client'));
            copyDirectory(path.join(templatePath, 'src', 'server'), path.join(destinationPath, 'src', 'server'));
            break;
        case 'Lua':
            copyDirectory(path.join(templatePath, 'client'), path.join(destinationPath, 'client'));
            copyDirectory(path.join(templatePath, 'server'), path.join(destinationPath, 'server'));
            break;
        default:
            console.error(chalk.red("Unsupported language."));
            break;
    }

    console.info(chalk.green(`Resource ${resourceName} created successfully in ${destinationPath}`));
});
