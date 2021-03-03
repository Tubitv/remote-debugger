Remote Debugger
================

> Inspired by the [devtools-backend](https://github.com/christian-bromann/devtools-backend) created by [
Christian Bromann](https://github.com/christian-bromann). We hope this can help you on debugging on arbitrary web platforms and save your life.

A Node.JS implementation of the Chrome DevTools for debugging arbitrary web platforms (e.g. OTT device like FireTV, Vizio, etc). It is similar to [weinre](https://people.apache.org/~pmuellr/weinre/docs/latest/Home.html) and we replace the web inspector with [devtools-frontend](https://github.com/ChromeDevTools/devtools-frontend). Also, we have added some useful features like network mock, redux view, etc.

## Requirements

- [Node.js](https://nodejs.org/en/) (v10 or higher)

## Usage

Git clone this repo and then install.

```
$ yarn install
```

And then start the server.

```
$ yarn start
```

Now you can visit [http://localhost:9222/](http://localhost:9222/) to get our inspectable page.

You can choose to open the [demo page](http://localhost:9222/demo/index.html) to play with it too.

Or you can inject our script in your web app to debug your app.

```js
<script src="http://localhost:9222/scripts/launcher.js" data-origin="debugger"></script>
```

You can deploy this tool on your server so that you can visit it with a certain domain.

## Feature

You will learn some features of the remote debugger in this part. For most features, it's almost the same as the Chrome DevTools. It's super easy for you to get familiar with our tools.

### Elements

The Elements panel is the same as the Elements panel you used in the Chrome DevTools.

![Jan-11-2021 21-06-05](https://user-images.githubusercontent.com/2577157/104186474-6c3db680-5451-11eb-9049-b14749d3600f.gif)

![highlightNode](https://user-images.githubusercontent.com/687412/104194996-07885900-545d-11eb-97d7-4de972facb93.gif)

### Console

The Console panel is also the same as the Console panel you used in the Chrome DevTools. 

You can see the logs from your web app.

![Jan-11-2021 21-17-36](https://user-images.githubusercontent.com/2577157/104187388-ace9ff80-5452-11eb-8fa9-bfd0445b5aab.gif)

You can also run scripts through the remote debugger.

![Jan-11-2021 21-18-22](https://user-images.githubusercontent.com/2577157/104187409-b70bfe00-5452-11eb-9eef-3c4f5aca7adc.gif)

### Network

The network panel is super handy.

![Jan-11-2021 21-20-43](https://user-images.githubusercontent.com/2577157/104187595-018d7a80-5453-11eb-8dfd-d150e200a248.gif)

We also have a panel to help you mock network requests. You can replace the network request with a mocky URL. As you can see, I add a rule to replace the request whose URL includes the `demo` string with a mocky URL. When I enable the rule, the network request has been replaced with the mocky URL. I can disable it easily if I don't need this anymore.

https://user-images.githubusercontent.com/2577157/104190902-b9248b80-5457-11eb-9f2b-f0831c755784.mp4

You can also share your config with your teammates.

![Jan-11-2021 22-02-12](https://user-images.githubusercontent.com/2577157/104191694-cd1cbd00-5458-11eb-9ead-12acb9704999.gif)

Hope this tool can save your life.

### Redux

Redux is the most popular state management tool. Redux devTools is a super handy tool to help us debug. The remote debugger has built a relay to help us use Redux devtool on our web app.

![Jan-11-2021 22-31-50](https://user-images.githubusercontent.com/2577157/104195361-7c5b9300-545d-11eb-89ac-423c7270f369.gif)

## Contribution

### Installation

To run the server you need to first clone the repo and install all its dependencies:

```sh
$ cd remote-debugger
# install dependencies
$ yarn install
# run dev
$ yarn run dev
```

You now have started the server on `localhost:9222`. You can see a list of inspectable pages on http://localhost:9222 (also available as [json](http://localhost:9222/json)).

### Chrome Devtools Frontend

We use the [Chrome Devtools Frontend](https://github.com/ChromeDevTools/devtools-frontend) as the UI of the remote debugger. As the Chrome Devtools Frontend is a very huge project, we haven't put it in the repo. You can find the Chrome Devtools Frontend in the node_modules folder.

#### How to modify the Chrome Devtools Frontend

You may notice that we have a `chrome-devtools-frontend` folder in the source too. That's where we modify the devtools frontend code.

We will sync the file from this folder to the `chrome-devtools-frontend` folder in the node_modules. You can see the scripts from `scripts/debugExtension.js`. We will run this script when you run `yarn run dev`.

Sync file is not a good option, we need to restore the change when we finish development. But I have not found out a good way to solve this, you can run `yarn run restore` to solve this problem.

#### How to upgrade the Chrome Devtools Frontend

Before you start to upgrade, remember to run `yarn run dev` to clear the change you made. Otherwise, you will meet some really strange problems.

It's pretty easy to upgrade the package, just install the latest version from npm or add the latest version from yarn. You can see the version list from [here](https://www.npmjs.com/package/chrome-devtools-frontend).

> But not every version works well. Some of the versions may even break when we install the package. The newest version I try that can work is "1.0.734346".

When you run some of the version you may meet some problems, such as `document.registerElement is not a function`. 
* First of all, you should check that have you run the restore script at first. 
* If you have already run that, there may be something wrong with this version, I recommend you to install another version.
* If you really want this version, you can install some polyfill as it is based on web components. You can use something like https://github.com/WebReflection/document-register-element.

***

This project was heavily based on [devtools-backend](https://github.com/christian-bromann/devtools-backend) by [Christian Bromann](https://github.com/christian-bromann).
