20-1-2026:
---
npm- short for node package manager 
two main purposes; worlds largest software registry, containing packages(reusable blocks of code that solve specific problems) and a CLI, command line interface, which is a tool to run in terminal to download, update and manage these packages for your own projects. 
When npm is used in a project it relies on two main components to manage the code and its dependencies(external packages downloaded and used)

package.json: this is essentially the ID card for your project. It is a text file that lists
- metadata- the projects name, version, and description
- dependencies- a list of every npm package the project needs to run 
- scripts- shortcuts for common tasks(like starting server or running tests)

node_modeules: when the packages are actually installed, they are stored in this folder. this is where the source code for every library downloaded is. it can be very large because it is not just the packages that are used but also the packages that those packages are reliant on. 

npm init- command you run to initialize a new project. it asks you a series of questions in the terminal, like the name of the project, version number, and description. After it automatically creates the package.json file. 