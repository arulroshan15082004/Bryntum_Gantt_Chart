import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
  ProjectOutline,
  DashboardOutline,
  ScheduleOutline,
  TableOutline,
  TeamOutline,
  MenuUnfoldOutline,
  MenuFoldOutline,
  PlusOutline,
  DeleteOutline,
  EditOutline,
  InfoCircleOutline,
  UploadOutline,
  LinkOutline,
  DownOutline,
  RightOutline,
  TrophyOutline,
  FolderOutline,
  FileTextOutline,
  FolderOpenOutline,
  MailOutline,
  UnorderedListOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  SaveOutline,
  RightSquareTwoTone,
  LeftSquareTwoTone
} from '@ant-design/icons-angular/icons';

registerLocaleData(en);

const icons = [
  ProjectOutline,
  DashboardOutline,
  ScheduleOutline,
  TableOutline,
  TeamOutline,
  MenuUnfoldOutline,
  MenuFoldOutline,
  PlusOutline,
  DeleteOutline,
  EditOutline,
  InfoCircleOutline,
  UploadOutline,
  LinkOutline,
  DownOutline,
  RightOutline,
  TrophyOutline,
  FolderOutline,
  FileTextOutline,
  FolderOpenOutline,
  MailOutline,
  UnorderedListOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  SaveOutline,
  RightSquareTwoTone,
  LeftSquareTwoTone
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideNzI18n(en_US),
    provideNzIcons(icons)
  ]
};

