import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSpinModule } from 'ng-zorro-antd/spin';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, NzSpinModule],
  template: `
    <div *ngIf="visible" class="loading-overlay">
      <nz-spin nzSimple [nzSize]="'large'" [nzTip]="tip"></nz-spin>
    </div>
  `,
  styles: [
    `
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
        transition: all 0.3s ease;
      }
    `,
  ],
})
export class LoadingComponent {
  @Input() visible: boolean = false;
  @Input() tip: string = 'Loading...';
}
