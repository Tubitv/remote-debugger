/* eslint-disable react/display-name */
import React, { useState } from 'react';
import { Button, Checkbox, Icon, Tab } from 'semantic-ui-react';

import { Elements, Console, Network, RemoteDebug, Redux } from '../components/panels';

import styles from './Demo.module.css';

const inspectorId = 'remoteInspector';
const reloadInspectorPage = (url: string): void => {
  const iframeElement = document.getElementById(inspectorId) as HTMLIFrameElement;
  iframeElement.src = url;
};

const getInspectorUrl = (uuid: string): string => {
  const { protocol, host } = window.location;
  return `${protocol}//${host}/devtools/inspector.html?${protocol === 'https' ? 'wss' : 'ws'}=${host}/devtools/page/${uuid}`;
};

const panes = [
  { menuItem: 'Elements', render: (): JSX.Element => <Tab.Pane>{<Elements />}</Tab.Pane> },
  { menuItem: 'Console', render: (): JSX.Element => <Tab.Pane>{<Console />}</Tab.Pane> },
  { menuItem: 'Network', render: (): JSX.Element => <Tab.Pane>{<Network />}</Tab.Pane> },
  { menuItem: 'RemoteDebug', render: (): JSX.Element => <Tab.Pane>{<RemoteDebug />}</Tab.Pane> },
  { menuItem: 'Redux', render: (): JSX.Element => <Tab.Pane>{<Redux />}</Tab.Pane> },
];

const Demo: React.FunctionComponent = () => {
  const uuid = localStorage.getItem('remote_debugger_uuid');
  const inspectorUrl = getInspectorUrl(uuid);
  const [enabled, setEnabled] = useState(true);

  const toggle = (): void => {
    window.remoteDebuggerLauncher.toggle();
    setEnabled(!enabled);
  };

  return (
    <div>
      <header className={styles.header}>
        <h1>Remote Debugger Demo</h1>
      </header>

      <div className={styles.content}>
        <div>
          <h2>Instruction</h2>
          <h5>Step 1. Inject Launcher Script in Target Web Application</h5>
          <pre><code>{`<script src="${window.location.origin}/scripts/launcher.js" data-origin="debugger"></script>`}</code></pre>
          <h5>Step 2. Visit <a href="/" target="_blank">Remote Debugger Service</a></h5>
          <p>
            Once you open a page with a web client (like a browser) it should register your page and it should then be inspectable.
            You should be able to see your page in the left &quot;Inspectable pages&quot; section.
          </p>
          <h5>Step 3. Use DevTools to Inspect Your Web Application</h5>
          <p>
            Click your page item and then an DevTools page should come to you.
            Just like DevTools in Chrome browser, you can see a DevTools in the new open page connected to your web application,
            now you can use this great tool to inspect it.
          </p>
          <p>Enjoy &#128521;</p>
        </div>

        <h2>Features</h2>
        <div className={styles.toggle}>Enable remote debugger:
          <Checkbox
            label={enabled ? 'ON' : 'OFF'}
            toggle
            checked={enabled}
            onChange={toggle}
            style={{ marginLeft: '5px' }}
          />
        </div>
        <Tab panes={panes} />

        {inspectorUrl &&
        <div className={styles.inspector}>
          <h2>Remote Inspector</h2>
          <p>Here we embed the inspector page in step 3 for convenience of the demo. In practice you can open the page in step 2. </p>
          <div className={styles.inspectorUrl}>
            <a href={inspectorUrl} target="_blank" rel="noreferrer">{inspectorUrl}</a>
            <Button icon onClick={(): void => reloadInspectorPage(inspectorUrl)}>
              <Icon name='refresh' />
            </Button>
          </div>
          <iframe id={inspectorId}
            title="Remote Inspector"
            src={inspectorUrl}
          >
          </iframe>
        </div>}
      </div>

      <footer className={styles.footer}>
        Remote Debugger - debug your web page anywhere!
      </footer>
    </div>
  );
};

export default Demo;
