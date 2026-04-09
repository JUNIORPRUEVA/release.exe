import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto } from '../projects/dto/create-project.dto';
import { ProjectsService } from '../projects/projects.service';
import { CompleteUploadVersionDto } from '../versions/dto/complete-upload-version.dto';
import { ListVersionsQueryDto } from '../versions/dto/list-versions-query.dto';
import { PresignUploadVersionDto } from '../versions/dto/presign-upload-version.dto';
import { UploadVersionDto } from '../versions/dto/upload-version.dto';
import { VersionsService } from '../versions/versions.service';

@Controller()
export class AdminController {
  constructor(
    private readonly configService: ConfigService,
    private readonly projectsService: ProjectsService,
    private readonly versionsService: VersionsService,
  ) {}

  @Get()
  redirectRoot(@Res() response: Response): void {
    response.redirect('/admin');
  }

  @Get('admin')
  renderAdmin(@Res() response: Response): void {
    response.type('html').send(this.renderPage());
  }

  @Post('api/v1/admin/projects')
  @UseGuards(JwtAuthGuard)
  async createProject(@Body() payload: CreateProjectDto) {
    const project = await this.projectsService.createProject(payload);

    return {
      id: project.id,
      name: project.name,
      api_key: project.apiKey,
      is_active: project.isActive,
      created_at: project.createdAt,
    };
  }

  @Get('api/v1/admin/projects')
  @UseGuards(JwtAuthGuard)
  async listProjects() {
    const projects = await this.projectsService.listProjects();

    return {
      items: projects.map((project) => ({
        id: project.id,
        name: project.name,
        api_key: project.apiKey,
        is_active: project.isActive,
        created_at: project.createdAt,
      })),
    };
  }

  @Delete('api/v1/admin/projects/:id')
  @UseGuards(JwtAuthGuard)
  async deleteProject(@Param('id') id: string) {
    await this.projectsService.deleteProject(id);

    return {
      deleted: true,
      id,
    };
  }

  @Post('api/v1/admin/upload-version')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadVersion(@UploadedFile() file: Express.Multer.File, @Body() payload: UploadVersionDto) {
    const version = await this.versionsService.uploadVersion(file, payload);

    return {
      id: version.id,
      project_id: version.projectId,
      platform: version.platform,
      version: version.version,
      build_number: version.buildNumber,
      download_url: version.downloadUrl,
      file_size: version.fileSize,
      release_notes: version.releaseNotes,
      is_required: version.isRequired,
      is_active: version.isActive,
      min_supported_build: version.minSupportedBuild,
      created_at: version.createdAt,
    };
  }

  @Post('api/v1/admin/upload-version/presign')
  @UseGuards(JwtAuthGuard)
  async presignUploadVersion(@Body() payload: PresignUploadVersionDto) {
    const directUpload = await this.versionsService.createDirectUploadTarget(payload);

    return {
      direct_upload: true,
      upload_url: directUpload.uploadUrl,
      method: directUpload.method,
      headers: directUpload.headers,
      storage_key: directUpload.storageKey,
      download_url: directUpload.downloadUrl,
      expires_in_seconds: directUpload.expiresInSeconds,
    };
  }

  @Post('api/v1/admin/upload-version/complete')
  @UseGuards(JwtAuthGuard)
  async completeUploadVersion(@Body() payload: CompleteUploadVersionDto) {
    const version = await this.versionsService.completeDirectUpload(payload);

    return {
      id: version.id,
      project_id: version.projectId,
      platform: version.platform,
      version: version.version,
      build_number: version.buildNumber,
      download_url: version.downloadUrl,
      file_size: version.fileSize,
      release_notes: version.releaseNotes,
      is_required: version.isRequired,
      is_active: version.isActive,
      min_supported_build: version.minSupportedBuild,
      created_at: version.createdAt,
    };
  }

  @Get('api/v1/admin/versions')
  @UseGuards(JwtAuthGuard)
  async listVersions(@Query() query: ListVersionsQueryDto) {
    const versions = await this.versionsService.listVersions(query);

    return {
      items: versions.map((version) => ({
        id: version.id,
        project_id: version.projectId,
        project_name: version.project.name,
        platform: version.platform,
        version: version.version,
        build_number: version.buildNumber,
        download_url: version.downloadUrl,
        file_size: version.fileSize,
        release_notes: version.releaseNotes,
        is_required: version.isRequired,
        is_active: version.isActive,
        min_supported_build: version.minSupportedBuild,
        created_at: version.createdAt,
      })),
    };
  }

  @Patch('api/v1/admin/versions/:id/activate')
  @UseGuards(JwtAuthGuard)
  async activateVersion(@Param('id') id: string) {
    const version = await this.versionsService.activateVersion(id);

    return {
      id: version.id,
      is_active: version.isActive,
    };
  }

  @Delete('api/v1/admin/versions/:id')
  @UseGuards(JwtAuthGuard)
  async deleteVersion(@Param('id') id: string) {
    await this.versionsService.deleteVersion(id);

    return {
      deleted: true,
      id,
    };
  }

  private renderPage(): string {
    const directUploadEnabled = this.versionsService.isDirectUploadEnabled();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Version Admin</title>
    <style>
      :root {
        --bg: #f4f1ea;
        --panel: #fffdf8;
        --border: #dccfb8;
        --text: #2c2418;
        --muted: #6f6658;
        --accent: #1f6f78;
        --accent-2: #c44536;
        --success: #1b6b46;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(196, 69, 54, 0.12), transparent 28%),
          radial-gradient(circle at top right, rgba(31, 111, 120, 0.16), transparent 24%),
          linear-gradient(180deg, #efe7da 0%, var(--bg) 42%, #f8f5ef 100%);
      }
      .shell {
        max-width: 1180px;
        margin: 0 auto;
        padding: 24px;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: end;
        margin-bottom: 20px;
      }
      .hero h1 {
        margin: 0;
        font-size: 36px;
      }
      .hero p {
        margin: 8px 0 0;
        color: var(--muted);
        max-width: 640px;
      }
      .grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 20px;
      }
      .panel {
        background: rgba(255, 253, 248, 0.92);
        backdrop-filter: blur(6px);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 14px 32px rgba(44, 36, 24, 0.08);
      }
      .stack {
        display: grid;
        gap: 18px;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 14px;
        color: var(--muted);
      }
      input, select, textarea, button {
        font: inherit;
      }
      input, select, textarea {
        width: 100%;
        padding: 11px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.88);
        color: var(--text);
      }
      textarea {
        min-height: 96px;
        resize: vertical;
      }
      .form-grid {
        display: grid;
        gap: 12px;
      }
      .split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        color: #fff;
        background: var(--accent);
        cursor: pointer;
      }
      button.secondary {
        background: var(--accent-2);
      }
      button.ghost {
        background: transparent;
        color: var(--accent);
        border: 1px solid var(--border);
      }
      .muted {
        color: var(--muted);
        font-size: 13px;
      }
      .status {
        min-height: 20px;
        font-size: 13px;
      }
      .status.success { color: var(--success); }
      .status.error { color: var(--accent-2); }
      .upload-progress {
        display: grid;
        gap: 8px;
        margin-top: 6px;
      }
      .progress-track {
        position: relative;
        overflow: hidden;
        height: 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(220, 207, 184, 0.35);
      }
      .progress-bar {
        height: 100%;
        width: 0%;
        border-radius: inherit;
        background: linear-gradient(90deg, #1f6f78 0%, #2f8f99 100%);
        transition: width 0.2s ease;
      }
      .progress-track.processing .progress-bar {
        width: 100%;
        background: linear-gradient(90deg, rgba(31, 111, 120, 0.3) 0%, #1f6f78 45%, rgba(31, 111, 120, 0.3) 100%);
        background-size: 220px 100%;
        animation: progress-processing 1.2s linear infinite;
      }
      .progress-meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 12px;
        color: var(--muted);
      }
      .progress-phase {
        font-size: 12px;
        color: var(--text);
      }
      .project-card, .version-row {
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.7);
      }
      .project-card strong, .version-row strong {
        display: block;
      }
      .project-card code {
        display: block;
        overflow-wrap: anywhere;
        margin-top: 8px;
        font-size: 12px;
      }
      .project-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      }
      .version-row {
        display: grid;
        gap: 8px;
      }
      .version-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .hidden { display: none; }
      @keyframes progress-processing {
        from { background-position: 220px 0; }
        to { background-position: 0 0; }
      }
      @media (max-width: 900px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hero">
        <div>
          <h1>App Version Admin</h1>
          <p>Manage projects, upload releases, and control active builds for Android and Windows clients.</p>
        </div>
        <button class="ghost hidden" id="logoutButton">Logout</button>
      </div>
      <div class="grid">
        <div class="stack">
          <section class="panel" id="loginPanel">
            <h2>Admin Login</h2>
            <form id="loginForm" class="form-grid">
              <label>Username<input name="username" required /></label>
              <label>Password<input type="password" name="password" required /></label>
              <button type="submit">Get Access Token</button>
              <div id="loginStatus" class="status"></div>
            </form>
          </section>
          <section class="panel hidden" id="projectPanel">
            <h2>Create Project</h2>
            <form id="projectForm" class="form-grid">
              <label>Project Name<input name="name" placeholder="my-app" required /></label>
              <button type="submit">Create Project</button>
              <div id="projectStatus" class="status"></div>
            </form>
            <div style="margin-top: 16px; display: grid; gap: 10px;" id="projectList"></div>
          </section>
        </div>
        <div class="stack hidden" id="dashboard">
          <section class="panel">
            <h2>Upload Version</h2>
            <div class="muted" style="margin-bottom: 12px;">Each new upload replaces the current file for the same project and platform. If you upload the same build again, the stored file is replaced with the new one.</div>
            <form id="uploadForm" class="form-grid">
              <label>Project<select name="project_id" id="projectSelect" required></select></label>
              <div class="split">
                <label>Platform
                  <select name="platform" required>
                    <option value="android">Android</option>
                    <option value="windows">Windows</option>
                  </select>
                </label>
                <label>Version<input name="version" placeholder="1.0.3" required /></label>
              </div>
              <div class="split">
                <label>Build Number<input type="number" min="1" name="build_number" required /></label>
                <label>Min Supported Build<input type="number" min="0" name="min_supported_build" value="0" /></label>
              </div>
              <label>Release Notes<textarea name="release_notes" placeholder="Summary of fixes and features"></textarea></label>
              <div class="split">
                <label><span>File</span><input type="file" name="file" required /></label>
                <div class="form-grid">
                  <label><span>Required Update</span><select name="is_required"><option value="false">No</option><option value="true">Yes</option></select></label>
                  <label><span>Activate Immediately</span><select name="is_active"><option value="true">Yes</option><option value="false">No</option></select></label>
                </div>
              </div>
              <button type="submit">Upload Release</button>
              <div id="uploadStatus" class="status"></div>
              <div id="uploadProgress" class="upload-progress hidden">
                <div id="uploadPhase" class="progress-phase"></div>
                <div id="uploadProgressTrack" class="progress-track">
                  <div id="uploadProgressBar" class="progress-bar"></div>
                </div>
                <div class="progress-meta">
                  <span id="uploadPercent">0%</span>
                  <span id="uploadTransferred">0 B / 0 B</span>
                  <span id="uploadSpeed">0 B/s</span>
                  <span id="uploadEta">ETA --</span>
                </div>
              </div>
            </form>
          </section>
          <section class="panel">
            <div class="split" style="align-items: end;">
              <label>Filter By Project<select id="projectFilter"><option value="">All projects</option></select></label>
              <button class="ghost" id="refreshVersionsButton" type="button">Refresh Versions</button>
            </div>
            <div style="margin-top: 16px; display: grid; gap: 12px;" id="versionList"></div>
          </section>
        </div>
      </div>
    </div>
    <script>
      const tokenKey = 'version-admin-token';
      const loginPanel = document.getElementById('loginPanel');
      const projectPanel = document.getElementById('projectPanel');
      const dashboard = document.getElementById('dashboard');
      const logoutButton = document.getElementById('logoutButton');
      const projectSelect = document.getElementById('projectSelect');
      const projectFilter = document.getElementById('projectFilter');
      const projectList = document.getElementById('projectList');
      const versionList = document.getElementById('versionList');
      const uploadProgress = document.getElementById('uploadProgress');
      const uploadProgressTrack = document.getElementById('uploadProgressTrack');
      const uploadProgressBar = document.getElementById('uploadProgressBar');
      const uploadPhase = document.getElementById('uploadPhase');
      const uploadPercent = document.getElementById('uploadPercent');
      const uploadTransferred = document.getElementById('uploadTransferred');
      const uploadSpeed = document.getElementById('uploadSpeed');
      const uploadEta = document.getElementById('uploadEta');
      const directUploadEnabled = ${directUploadEnabled ? 'true' : 'false'};

      function getToken() {
        return localStorage.getItem(tokenKey);
      }

      function setStatus(id, message, type) {
        const element = document.getElementById(id);
        element.textContent = message || '';
        element.className = 'status' + (type ? ' ' + type : '');
      }

      function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) {
          return '0 B';
        }

        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
          value /= 1024;
          unitIndex += 1;
        }

        const digits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
        return value.toFixed(digits) + ' ' + units[unitIndex];
      }

      function formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) {
          return 'ETA 0s';
        }

        if (seconds < 60) {
          return 'ETA ' + Math.ceil(seconds) + 's';
        }

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.ceil(seconds % 60);
        return 'ETA ' + minutes + 'm ' + remainingSeconds + 's';
      }

      function resetUploadProgress() {
        uploadProgress.classList.add('hidden');
        uploadProgressTrack.classList.remove('processing');
        uploadProgressBar.style.width = '0%';
        uploadPhase.textContent = '';
        uploadPercent.textContent = '0%';
        uploadTransferred.textContent = '0 B / 0 B';
        uploadSpeed.textContent = '0 B/s';
        uploadEta.textContent = 'ETA --';
      }

      function setUploadProgressState(state) {
        uploadProgress.classList.remove('hidden');
        uploadProgressTrack.classList.toggle('processing', Boolean(state.processing));
        uploadProgressBar.style.width = (state.processing ? 100 : Math.max(0, Math.min(100, state.percent || 0))) + '%';
        uploadPhase.textContent = state.phase || '';
        uploadPercent.textContent = Math.max(0, Math.min(100, Math.round(state.percent || 0))) + '%';
        uploadTransferred.textContent = state.transferred || '0 B / 0 B';
        uploadSpeed.textContent = state.speed || '0 B/s';
        uploadEta.textContent = state.eta || 'ETA --';
      }

      async function fetchWithTimeout(path, options = {}, timeoutMs = 30000) {
        if (!timeoutMs || timeoutMs <= 0) {
          return fetch(path, options);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          return await fetch(path, {
            ...options,
            signal: controller.signal,
          });
        } catch (error) {
          if (error && error.name === 'AbortError') {
            throw new Error('The request took too long. Check storage configuration and server logs.');
          }

          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      async function parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          return response.json().catch(() => ({}));
        }

        const text = await response.text().catch(() => '');
        return { rawText: text };
      }

      function buildRequestError(response, payload, fallbackMessage) {
        const apiMessage = payload && payload.error && payload.error.message;
        if (apiMessage) {
          return new Error(apiMessage);
        }

        const rawText = payload && payload.rawText ? String(payload.rawText).replace(/\s+/g, ' ').trim() : '';
        const shortText = rawText.slice(0, 180);

        if (response.status === 413) {
          return new Error('The file is too large for the server or proxy. Increase the upload limit in EasyPanel or upload a smaller file.');
        }

        if (shortText) {
          return new Error('HTTP ' + response.status + ' ' + response.statusText + ': ' + shortText);
        }

        return new Error('HTTP ' + response.status + ' ' + response.statusText + ': ' + fallbackMessage);
      }

      function uploadWithProgress(path, formData, options = {}) {
        const { timeoutMs = 0, onProgress } = options;

        return new Promise((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open('POST', path, true);

          const token = getToken();
          if (token) {
            request.setRequestHeader('Authorization', 'Bearer ' + token);
          }

          if (timeoutMs > 0) {
            request.timeout = timeoutMs;
          }

          request.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
              onProgress({
                loaded: event.loaded,
                total: event.total,
              });
            }
          });

          request.addEventListener('load', () => {
            const payload = (() => {
              const contentType = request.getResponseHeader('content-type') || '';
              const rawText = request.responseText || '';

              if (contentType.includes('application/json')) {
                try {
                  return JSON.parse(rawText || '{}');
                } catch {
                  return {};
                }
              }

              return { rawText };
            })();

            if (request.status >= 200 && request.status < 300) {
              resolve(payload);
              return;
            }

            reject(buildRequestError({ status: request.status, statusText: request.statusText }, payload, 'Upload failed'));
          });

          request.addEventListener('error', () => {
            reject(new Error('Network error while uploading the file'));
          });

          request.addEventListener('abort', () => {
            reject(new Error('The upload was canceled before completion'));
          });

          request.addEventListener('timeout', () => {
            reject(new Error('The upload took too long. Check your network or server configuration.'));
          });

          request.send(formData);
        });
      }

      function uploadBinaryWithProgress(url, file, options = {}) {
        const { method = 'PUT', headers = {}, timeoutMs = 0, onProgress } = options;

        return new Promise((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open(method, url, true);

          Object.entries(headers).forEach(([key, value]) => {
            request.setRequestHeader(key, value);
          });

          if (timeoutMs > 0) {
            request.timeout = timeoutMs;
          }

          request.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
              onProgress({ loaded: event.loaded, total: event.total });
            }
          });

          request.addEventListener('load', () => {
            if (request.status >= 200 && request.status < 300) {
              resolve({ status: request.status });
              return;
            }

            reject(new Error('Direct storage upload failed with HTTP ' + request.status + ' ' + request.statusText));
          });

          request.addEventListener('error', () => {
            reject(new Error('Network error while uploading directly to storage. Verify bucket CORS and connectivity.'));
          });

          request.addEventListener('abort', () => {
            reject(new Error('Direct storage upload was canceled before completion'));
          });

          request.addEventListener('timeout', () => {
            reject(new Error('Direct storage upload timed out'));
          });

          request.send(file);
        });
      }

      async function api(path, options = {}) {
        const { timeoutMs = 30000, headers = {}, ...restOptions } = options;
        const response = await fetchWithTimeout(path, {
          ...restOptions,
          headers: {
            ...headers,
            Authorization: 'Bearer ' + getToken(),
          },
        }, timeoutMs);
        const data = await parseResponse(response);

        if (!response.ok) {
          throw buildRequestError(response, data, 'Request failed');
        }

        return data;
      }

      function showDashboard(isAuthenticated) {
        loginPanel.classList.toggle('hidden', isAuthenticated);
        projectPanel.classList.toggle('hidden', !isAuthenticated);
        dashboard.classList.toggle('hidden', !isAuthenticated);
        logoutButton.classList.toggle('hidden', !isAuthenticated);
      }

      function projectOption(project) {
        return '<option value="' + project.id + '">' + project.name + '</option>';
      }

      function renderProjects(items) {
        projectSelect.innerHTML = items.map(projectOption).join('');
        projectFilter.innerHTML = '<option value="">All projects</option>' + items.map(projectOption).join('');
        projectList.innerHTML = items.map((project) =>
          '<div class="project-card"><strong>' + project.name + '</strong><div class="muted">Created ' + new Date(project.created_at).toLocaleString() + '</div><code>' + project.api_key + '</code><div class="project-actions"><button type="button" class="secondary" data-delete-project="' + project.id + '">Delete project</button></div></div>'
        ).join('') || '<div class="muted">No projects yet.</div>';
      }

      function renderVersions(items) {
        versionList.innerHTML = items.map((version) =>
          '<div class="version-row">'
          + '<strong>' + version.project_name + ' / ' + version.platform + ' / ' + version.version + ' (' + version.build_number + ')</strong>'
          + '<div class="muted">Active: ' + (version.is_active ? 'yes' : 'no') + ' | Required: ' + (version.is_required ? 'yes' : 'no') + ' | Min supported build: ' + version.min_supported_build + '</div>'
          + '<div class="muted">' + (version.release_notes || 'No release notes') + '</div>'
          + '<a href="' + version.download_url + '" target="_blank" rel="noreferrer">Download file</a>'
          + '<div class="version-actions">'
          + '<button type="button" data-activate="' + version.id + '">Activate</button>'
          + '<button type="button" class="secondary" data-delete="' + version.id + '">Delete</button>'
          + '</div>'
          + '</div>'
        ).join('') || '<div class="muted">No versions found.</div>';
      }

      async function loadProjects() {
        const data = await api('/api/v1/admin/projects');
        renderProjects(data.items);
      }

      async function loadVersions() {
        const projectId = projectFilter.value;
        const query = projectId ? '?project_id=' + encodeURIComponent(projectId) : '';
        const data = await api('/api/v1/admin/versions' + query);
        renderVersions(data.items);
      }

      async function bootstrap() {
        const token = getToken();
        showDashboard(Boolean(token));

        if (!token) {
          return;
        }

        try {
          await loadProjects();
          await loadVersions();
        } catch (error) {
          localStorage.removeItem(tokenKey);
          showDashboard(false);
          setStatus('loginStatus', error.message || 'Session expired', 'error');
        }
      }

      document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('loginStatus', 'Authenticating...', '');
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());

        try {
          const data = await fetchWithTimeout('/api/v1/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }, 15000).then(async (response) => {
            const json = await parseResponse(response);
            if (!response.ok) {
              throw buildRequestError(response, json, 'Login failed');
            }
            return json;
          });

          localStorage.setItem(tokenKey, data.token);
          showDashboard(true);
          setStatus('loginStatus', 'Authenticated', 'success');
          await loadProjects();
          await loadVersions();
        } catch (error) {
          setStatus('loginStatus', error.message || 'Login failed', 'error');
        }
      });

      document.getElementById('projectForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('projectStatus', 'Creating project...', '');
        const payload = Object.fromEntries(new FormData(event.target).entries());

        try {
          await api('/api/v1/admin/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          event.target.reset();
          setStatus('projectStatus', 'Project created', 'success');
          await loadProjects();
        } catch (error) {
          setStatus('projectStatus', error.message || 'Project creation failed', 'error');
        }
      });

      projectList.addEventListener('click', async (event) => {
        const deleteProjectButton = event.target.closest('[data-delete-project]');
        const projectId = deleteProjectButton ? deleteProjectButton.getAttribute('data-delete-project') : null;

        if (!projectId) {
          return;
        }

        const confirmed = window.confirm('Delete this project and all its releases permanently?');
        if (!confirmed) {
          return;
        }

        try {
          await api('/api/v1/admin/projects/' + projectId, { method: 'DELETE' });
          setStatus('projectStatus', 'Project deleted', 'success');
          setStatus('uploadStatus', 'Project and related releases deleted', 'success');
          await loadProjects();
          await loadVersions();
        } catch (error) {
          setStatus('projectStatus', error.message || 'Project deletion failed', 'error');
        }
      });

      document.getElementById('uploadForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = event.target.querySelector('button[type="submit"]');
        const buildNumberInput = event.target.elements.namedItem('build_number');
        const minSupportedBuildInput = event.target.elements.namedItem('min_supported_build');
        const fileInput = event.target.elements.namedItem('file');
        const buildNumber = Number((buildNumberInput && buildNumberInput.value) || 0);
        const minSupportedBuild = Number((minSupportedBuildInput && minSupportedBuildInput.value) || 0);
        const selectedFile = fileInput && fileInput.files ? fileInput.files[0] : null;

        if (minSupportedBuild > buildNumber) {
          resetUploadProgress();
          setStatus('uploadStatus', 'Min supported build cannot be greater than build number', 'error');
          return;
        }

        if (!selectedFile) {
          resetUploadProgress();
          setStatus('uploadStatus', 'Select a file before uploading', 'error');
          return;
        }

        if (selectedFile && selectedFile.size > 25 * 1024 * 1024) {
          setStatus('uploadStatus', 'Large file detected (' + Math.ceil(selectedFile.size / (1024 * 1024)) + ' MB). Upload may take several minutes. If it fails with HTTP 413, increase the upload limit in EasyPanel.', '');
        } else {
          setStatus('uploadStatus', 'Uploading release...', '');
        }
        const formData = new FormData(event.target);
        let uploadStartedAt = Date.now();

        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';
        setUploadProgressState({
          percent: 0,
          transferred: '0 B / ' + formatBytes(selectedFile.size),
          speed: '0 B/s',
          eta: 'ETA --',
          phase: 'Uploading file to server...',
          processing: false,
        });

        try {
          const payload = {
            project_id: event.target.elements.namedItem('project_id').value,
            platform: event.target.elements.namedItem('platform').value,
            version: event.target.elements.namedItem('version').value,
            build_number: Number(buildNumber),
            min_supported_build: Number(minSupportedBuild),
            release_notes: event.target.elements.namedItem('release_notes').value || '',
            is_required: event.target.elements.namedItem('is_required').value,
            is_active: event.target.elements.namedItem('is_active').value,
          };

          const updateProgress = ({ loaded, total, phase, processing = false }) => {
            const elapsedSeconds = Math.max((Date.now() - uploadStartedAt) / 1000, 0.25);
            const speedBytesPerSecond = loaded / elapsedSeconds;
            const percent = total > 0 ? (loaded / total) * 100 : 0;
            const remainingSeconds = speedBytesPerSecond > 0 ? (total - loaded) / speedBytesPerSecond : 0;

            setUploadProgressState({
              percent,
              transferred: formatBytes(loaded) + ' / ' + formatBytes(total),
              speed: formatBytes(speedBytesPerSecond) + '/s',
              eta: processing ? 'ETA 0s' : formatDuration(remainingSeconds),
              phase,
              processing,
            });
          };

          if (directUploadEnabled) {
            setStatus('uploadStatus', 'Preparing direct upload to cloud storage...', '');

            const presign = await api('/api/v1/admin/upload-version/presign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...payload,
                file_name: selectedFile.name,
                file_size: selectedFile.size,
                content_type: selectedFile.type || 'application/octet-stream',
              }),
              timeoutMs: 30000,
            });

            uploadStartedAt = Date.now();
            await uploadBinaryWithProgress(presign.upload_url, selectedFile, {
              method: presign.method || 'PUT',
              headers: presign.headers || { 'Content-Type': selectedFile.type || 'application/octet-stream' },
              timeoutMs: 0,
              onProgress: ({ loaded, total }) => {
                const uploadCompleted = total > 0 && loaded >= total;
                updateProgress({
                  loaded,
                  total,
                  phase: uploadCompleted
                    ? 'File uploaded to cloud storage. Finalizing release in server...'
                    : 'Uploading directly to cloud storage...',
                  processing: uploadCompleted,
                });
              },
            });

            await api('/api/v1/admin/upload-version/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...payload,
                storage_key: presign.storage_key,
                file_size: selectedFile.size,
                content_type: selectedFile.type || 'application/octet-stream',
              }),
              timeoutMs: 120000,
            });
          } else {
            await uploadWithProgress('/api/v1/admin/upload-version', formData, {
              timeoutMs: selectedFile.size > 25 * 1024 * 1024 ? 0 : 180000,
              onProgress: ({ loaded, total }) => {
                const uploadCompleted = total > 0 && loaded >= total;
                updateProgress({
                  loaded,
                  total,
                  phase: uploadCompleted ? 'Upload sent. Saving and processing on server...' : 'Uploading file to server...',
                  processing: uploadCompleted,
                });
              },
            });
          }

          event.target.reset();
          setUploadProgressState({
            percent: 100,
            transferred: formatBytes(selectedFile.size) + ' / ' + formatBytes(selectedFile.size),
            speed: 'Complete',
            eta: 'ETA 0s',
            phase: 'Upload completed successfully.',
            processing: false,
          });
          setStatus('uploadStatus', 'Version uploaded', 'success');
          await loadVersions();
        } catch (error) {
          uploadProgressTrack.classList.remove('processing');
          setStatus('uploadStatus', error.message || 'Upload failed', 'error');
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Upload Release';
        }
      });

      document.getElementById('refreshVersionsButton').addEventListener('click', loadVersions);
      projectFilter.addEventListener('change', loadVersions);

      versionList.addEventListener('click', async (event) => {
        const activateButton = event.target.closest('[data-activate]');
        const deleteButton = event.target.closest('[data-delete]');
        const activateId = activateButton ? activateButton.getAttribute('data-activate') : null;
        const deleteId = deleteButton ? deleteButton.getAttribute('data-delete') : null;

        try {
          if (activateId) {
            await api('/api/v1/admin/versions/' + activateId + '/activate', { method: 'PATCH' });
            setStatus('uploadStatus', 'Release activated', 'success');
            await loadVersions();
          }

          if (deleteId) {
            const confirmed = window.confirm('Delete this release permanently?');
            if (!confirmed) {
              return;
            }
            await api('/api/v1/admin/versions/' + deleteId, { method: 'DELETE' });
            setStatus('uploadStatus', 'Release deleted', 'success');
            await loadVersions();
          }
        } catch (error) {
          setStatus('uploadStatus', error.message || 'Action failed', 'error');
        }
      });

      logoutButton.addEventListener('click', () => {
        localStorage.removeItem(tokenKey);
        showDashboard(false);
      });

      resetUploadProgress();
      bootstrap();
    </script>
  </body>
</html>`;
  }
}