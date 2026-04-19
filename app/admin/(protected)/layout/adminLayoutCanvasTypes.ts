import type { HeroFloatingIcon } from "@/app/lib/frontendSettingsShared";

/** 後台「首頁版面」畫布：區塊選取、高度、裝飾圖拖曳（與分站首頁預覽共用型別） */
export type AdminLayoutCanvasConfig = {
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onBlockResizeHeight: (blockId: string, heightPx: number | null) => void;
  onBlockFloatingIconsChange: (blockId: string, next: HeroFloatingIcon[]) => void;
  /** 後台桌機／手機畫布：裝飾圖座標分別儲存 */
  floatingIconsCoordinateMode?: "desktop" | "mobile";
  selectedFloatingIconId?: string | null;
  onSelectFloatingIcon?: (blockId: string, iconId: string) => void;
  /** 桌機畫布目前縮放（0.25–1）；區塊高度拖曳與顯示依此換算為前台設計 px */
  canvasPreviewScale?: number;
  /**
   * 全頁裝飾圖（相對整頁根容器寬高之百分比，與區塊內裝飾圖分開）；
   * 在 {@link BranchSiteHomeView} 與首頁區塊同一畫布上疊加預覽／編輯。
   */
  viewportFloatingIcons?: HeroFloatingIcon[];
  onViewportFloatingIconsChange?: (next: HeroFloatingIcon[]) => void;
  selectedViewportFloatingIconId?: string | null;
  onSelectViewportFloatingIcon?: (id: string | null) => void;
  /** 於畫布主圖區觸發本機選檔／更換（與側欄上傳同一 input） */
  onHeroImagePickRequest?: () => void;
};
