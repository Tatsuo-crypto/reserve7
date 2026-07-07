import {
    ArrowLeftIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon,
    CalendarDaysIcon,
    CheckIcon,
    PlusIcon,
    Cog6ToothIcon,
    BellIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    ClockIcon,
    VideoCameraIcon,
    AcademicCapIcon,
    BuildingOfficeIcon,
    EnvelopeIcon,
    DocumentDuplicateIcon,
    LockClosedIcon,
    PencilSquareIcon,
    EyeIcon,
    LinkSlashIcon,
    ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

// N-3: 頻出上位のアイコン(戻る矢印・開閉シェブロン・閉じる・カレンダー等)をまず統一する。
// 残りの手書きSVGは画面を触るタイミングで随時ここに追加して置き換えていく。
// R-5: 取り残し3画面(その他設定・会員詳細・オンラインレッスン)対応で追加した分。
const ICONS = {
    back: ArrowLeftIcon,
    chevronDown: ChevronDownIcon,
    chevronUp: ChevronUpIcon,
    chevronLeft: ChevronLeftIcon,
    chevronRight: ChevronRightIcon,
    close: XMarkIcon,
    calendar: CalendarDaysIcon,
    check: CheckIcon,
    plus: PlusIcon,
    settings: Cog6ToothIcon,
    bell: BellIcon,
    warning: ExclamationTriangleIcon,
    search: MagnifyingGlassIcon,
    clock: ClockIcon,
    video: VideoCameraIcon,
    academicCap: AcademicCapIcon,
    building: BuildingOfficeIcon,
    envelope: EnvelopeIcon,
    copy: DocumentDuplicateIcon,
    lock: LockClosedIcon,
    pencil: PencilSquareIcon,
    eye: EyeIcon,
    linkSlash: LinkSlashIcon,
    clipboardList: ClipboardDocumentListIcon,
} as const

export type IconName = keyof typeof ICONS

export interface IconProps {
    name: IconName
    size?: number
    className?: string
    onClick?: () => void
}

/**
 * N-3: アイコンは手書きSVG・絵文字(🔴📅⚠️等)をやめ、heroicons(outline)経由に統一する。
 * このラッパー経由でのみ使わせることで、サイズ・線の太さ(strokeWidth)をアプリ全体で固定し、
 * 「同じ『戻る矢印』でも太さが3パターンある」ような揺れの再発を構造的に防ぐ。
 * strokeWidthは呼び出し側から変更できない(常に2固定)。
 */
export default function Icon({ name, size = 20, className = '', onClick }: IconProps) {
    const Component = ICONS[name]
    return (
        <Component
            width={size}
            height={size}
            strokeWidth={2}
            className={className}
            onClick={onClick}
            aria-hidden={onClick ? undefined : true}
        />
    )
}
