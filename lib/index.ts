import fs from 'fs';
import path from 'path';
import io from 'socket.io';
import ejs from 'ejs';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import favicon from 'serve-favicon';
import http from 'http';

import logger, { WrappedLogger } from './logger';
import Backend from './backend';
import { getDomain } from './utils';

export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = process.env.PORT || 9222;

const DEVTOOLS_PATH = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'chrome-devtools-frontend',
  'front_end'
);
const SCRIPT_PATH = path.resolve(__dirname, 'scripts');
const ASSETS_PATH = path.resolve(__dirname, 'assets');
const VIEWS_PATH = path.resolve(__dirname, '..', 'views');
const PAGES_TPL_PATH = path.resolve(VIEWS_PATH, 'pages.tpl.html');
const INDEX_TPL_PATH = path.resolve(VIEWS_PATH, 'index.tpl.html');
const ENV = process.env.NODE_ENV;

export default class DevToolsBackend {
  private host: string;
  private port: number | string;
  private log: WrappedLogger;
  private app: express.Express;
  private backend: Backend;
  private server: http.Server;
  public targetSocket: SocketIO.Server;

  constructor(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    this.host = host;
    this.port = port;
    this.log = logger();
    this.app = express();

    /**
     * check runtime conditions
     */
    this.preflightCheck();

    /**
     * initialise external middleware
     */
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(bodyParser.json());
    this.app.set('view engine', 'ejs');
    this.app.set('views', VIEWS_PATH);
    this.app.engine('html', ejs.renderFile);
    this.app.use(cookieParser());
    this.app.use(favicon(path.resolve(VIEWS_PATH, 'favicon.ico')));

    /**
     * enable cors
     */
    this.app.use(cors({ origin: true }));
    this.app.disable('etag');

    /**
     * paths
     */
    this.app.get('/', this.inspectablePages);
    this.app.get('/demo', (req, res) => {
      return res.sendFile(INDEX_TPL_PATH);
    });
    this.app.get('/api/json', this.json);
    this.app.get('/api/health', (req, res) => {
      res.send(200);
    });
    this.app.use('/devtools', express.static(DEVTOOLS_PATH));
    this.app.use('/scripts', express.static(SCRIPT_PATH));
    this.app.use('/assets', express.static(ASSETS_PATH));

    /**
     * initialise socket server
     */
    this.server = this.app.listen(this.port, () =>
      this.log.info(
        `Started devtools-backend server on ${this.host}:${this.port}`
      )
    );

    /**
     * initialise socket.io server
     * this connection manages web socket traffic between frontend scripts and devtools-backend
     */
    this.targetSocket = io(this.server, { origins: '*:*' });
    this.targetSocket.on('connection', socket => {
      socket.on('log', args => console.log(...args)); // dev debugging only
      socket.on('error:injectScript', e => this.log.error(e));
      socket.on('registerPage', (info) => {
        this.backend.bindPageWithTargetSocket(info, socket);
      });
    });

    /**
     * initialise Websocket Server
     * this connection manages web socket traffic between devtools-frontend and devtools-backend
     */
    this.backend = new Backend(this.targetSocket);
    this.server.on('upgrade', this.backend.upgradeWssSocket.bind(this.backend));
  }

  inspectablePages(req: express.Request, res: express.Response): void {
    return res.sendFile(PAGES_TPL_PATH);
  }

  json = (req: express.Request, res: express.Response): express.Response => {
    res.setHeader('Content-Type', 'application/json');
    const protocol = ENV === 'staging' || ENV === 'production' ? 'wss' : 'ws';
    return res.send(
      JSON.stringify(
        this.backend.pages.map(page => {
          const {
            description,
            url,
            metadata,
            deviceIp,
            uuid,
            deviceId,
            clientIp,
            isConnectedToClient,
            isConnectedToTarget,
            hostname,
            title: pageTitle,
          } = page;
          const devtoolsPath = `${hostname}/devtools/page/${uuid}`;
          const title = pageTitle || getDomain(url);
          return {
            description,
            devtoolsFrontendUrl: `/devtools/inspector.html?${protocol}=${devtoolsPath}`,
            title,
            type: 'page',
            url: url.href,
            metadata,
            deviceIp,
            uuid,
            deviceId,
            clientIp,
            webSocketDebuggerUrl: `${protocol}://${devtoolsPath}`,
            isConnectedToClient,
            isConnectedToTarget,
          };
        }),
        null,
        2
      )
    );
  }

  preflightCheck(): void {
    /**
     * preflight check: devtools-frontend was build
     */
    if (!fs.existsSync(DEVTOOLS_PATH)) {
      throw new Error(
        'Devtools frontend not found. Run `npm run build` to compile.'
      );
    }
  }

  close(): void {
    this.server.close();
  }
}

if (require.main === module) {
  new DevToolsBackend();
}
