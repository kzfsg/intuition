# intuition — the ide that teaches.

intuition is a fork of visual studio code that turns your codebase into a living course. it reads what you're working on and teaches it back to you — explaining the architecture, the patterns, and the why behind the code as you move through it. an editor that learns your project so it can help you learn it too.

built on [code - oss](https://github.com/microsoft/vscode), the open-source core of visual studio code. released under the [mit license](LICENSE.txt).

## the idea

most editors help you write code. intuition helps you understand it. open a repository and intuition turns it into something you can learn from — guided walkthroughs, contextual explanations, and lessons drawn directly from the code in front of you. it stays out of your way when you're shipping and steps in when you want to understand.

## getting started

intuition is built from source the same way as code - oss. clone the repo and follow the standard build steps:

```
git clone https://github.com/intuition/intuition.git
cd intuition
npm install
```

then run the editor from source with the scripts in `scripts/` (`./scripts/code.sh` on macOS/linux, `.\scripts\code.bat` on windows).

## contributing

there are many ways to get involved:

* file issues and feature requests at [github.com/intuition/intuition/issues](https://github.com/intuition/intuition/issues)
* review and open pull requests
* improve the docs

see [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## built on vs code (code - oss)

intuition is a downstream fork of [code - oss](https://github.com/microsoft/vscode), the open-source repository behind visual studio code. we owe a great deal to that project and the community around it. visual studio code and its logo are trademarks of microsoft; intuition is an independent project and is not affiliated with or endorsed by microsoft.

## license

licensed under the [mit](LICENSE.txt) license.
