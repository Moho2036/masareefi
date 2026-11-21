import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { SpotlightTour } from './SpotlightTour'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-tour-1' },
  }),
}))

describe('SpotlightTour Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('does not render when isOpen is false', () => {
    render(
      <MemoryRouter>
        <SpotlightTour isOpen={false} onFinish={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('dialog', { name: 'جولة بَصير السريعة' })).toBeNull()
    expect(screen.queryByText('الرصيد المتاح وحد الصرف اليومي')).toBeNull()
  })

  it('renders step 1 and navigates through all 8 steps with deep titles and previous button', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    // Step 1: لوحة التحكم
    expect(screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })).toBeInTheDocument()
    expect(screen.getByText('1 / 8')).toBeInTheDocument()
    expect(screen.getByText('لوحة التحكم وحد الصرف اليومي')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'السابق' })).toBeNull()

    // Step 2: إضافة معاملة
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('2 / 8')).toBeInTheDocument()
    expect(screen.getByText('إضافة معاملة سريعة وحسابات فورية (+)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'السابق' })).toBeInTheDocument()

    // Step 3: سجل المعاملات
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('3 / 8')).toBeInTheDocument()
    expect(screen.getByText('سجل المعاملات وإدارة الحركات')).toBeInTheDocument()
    expect(screen.getByText('معاملة تجريبية تفاعلية (Demo)')).toBeInTheDocument()

    // Step 4: الديون
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('4 / 8')).toBeInTheDocument()
    expect(screen.getByText('دفتر الديون وكشوفات الحساب')).toBeInTheDocument()
    expect(screen.getByText('معاينة: دين مسجل (سلفة أحمد)')).toBeInTheDocument()

    // Step 5: المتكررة
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('5 / 8')).toBeInTheDocument()
    expect(screen.getByText('المعاملات المتكررة وأتمتة الالتزامات')).toBeInTheDocument()
    expect(screen.getByText('معاينة: التزام دوري مجدول')).toBeInTheDocument()

    // Step 6: الأدوات والجمعيات
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('6 / 8')).toBeInTheDocument()
    expect(screen.getByText('الجمعيات وحاسبة ساعات العمل')).toBeInTheDocument()
    expect(screen.getByText('معاينة: صندوق جمعية عائلية')).toBeInTheDocument()

    // Step 7: التقارير
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('7 / 8')).toBeInTheDocument()
    expect(screen.getByText('التقارير المالية والرسوم البيانية')).toBeInTheDocument()
    expect(screen.getByText('معاينة: تحليل توزيع المصاريف')).toBeInTheDocument()

    // Step 8: الإعدادات والدورة المالية
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('8 / 8')).toBeInTheDocument()
    expect(screen.getByText('دورة الشهر المالي والأمان والنسخ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'فهمت، ابدأ الآن' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'التالي' })).toBeNull()

    // Previous button back to Step 7
    fireEvent.click(screen.getByRole('button', { name: 'السابق' }))
    expect(screen.getByText('7 / 8')).toBeInTheDocument()
    expect(screen.getByText('التقارير المالية والرسوم البيانية')).toBeInTheDocument()
  })

  it('interactively demonstrates desktop hover and mobile swipe gestures on transaction step', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    // Advance to step 3 (المعاملات)
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('3 / 8')).toBeInTheDocument()

    // Verify Demo Card exists
    expect(screen.getByText('مشتريات بقالة وسوبرماركت')).toBeInTheDocument()

    // Test Desktop mode actions
    const desktopTab = screen.getByRole('button', { name: /الحاسوب/ })
    fireEvent.click(desktopTab)
    expect(screen.getByText(/إظهار أزرار التعديل والحذف/)).toBeInTheDocument()

    // Test Mobile mode toggle & swipe
    const mobileTab = screen.getByRole('button', { name: /الهاتف/ })
    fireEvent.click(mobileTab)
    expect(screen.getByText(/اسحب لليمين/)).toBeInTheDocument()

    // Click "جرّب السحب لليمين الآن"
    const swipeBtn = screen.getByRole('button', { name: /جرّب السحب لليمين الآن/ })
    fireEvent.click(swipeBtn)

    // Swipe buttons revealed
    expect(screen.getByRole('button', { name: 'إعادة إغلاق السحب' })).toBeInTheDocument()
    const deleteBtn = screen.getByRole('button', { name: 'حذف' })
    fireEvent.click(deleteBtn)

    expect(screen.getByText(/محاكاة: تم تجربة "حذف المعاملة" بنجاح!/)).toBeInTheDocument()
  })

  it('completes tour on step 8, saves flag in localStorage, and calls onFinish', () => {
    const onFinish = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={onFinish} />
      </MemoryRouter>
    )

    // Advance to step 8 (click next 7 times)
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    // Step 8 finish button
    const finishBtn = screen.getByRole('button', { name: 'فهمت، ابدأ الآن' })
    expect(finishBtn).toBeInTheDocument()
    fireEvent.click(finishBtn)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
  })

  it('closes tour and saves flag in localStorage when skip button is clicked', () => {
    const onFinish = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={onFinish} />
      </MemoryRouter>
    )

    const skipBtn = screen.getByRole('button', { name: 'إغلاق الجولة' })
    expect(skipBtn).toBeInTheDocument()
    expect(skipBtn).toHaveTextContent('تخطي')
    fireEvent.click(skipBtn)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
  })

  it('correctly calculates targetRect and renders spotlight cutout when target element is in DOM', () => {
    const targetEl = document.createElement('div')
    targetEl.setAttribute('data-tour', 'hero-balance')
    targetEl.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      left: 50,
      width: 300,
      height: 150,
      bottom: 250,
      right: 350,
    })
    document.body.appendChild(targetEl)

    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const dialog = screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveStyle({ width: '440px' })

    document.body.removeChild(targetEl)
  })

  it('renders a dedicated scrollable container for content while keeping header and footer pinned', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const scrollContainer = screen.getByLabelText('محتوى الخطوة')
    expect(scrollContainer).toBeInTheDocument()
    expect(scrollContainer).toHaveClass('overflow-y-auto')

    const skipBtn = screen.getByRole('button', { name: 'إغلاق الجولة' })
    expect(skipBtn).toBeInTheDocument()

    const nextBtn = screen.getByRole('button', { name: 'التالي' })
    expect(nextBtn).toBeInTheDocument()
  })

  it('closes tour and saves flags when Escape key is pressed', () => {
    const onFinish = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={onFinish} />
      </MemoryRouter>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
    expect(window.localStorage.getItem('masareefi_tour_shown_user-tour-1')).toBe('true')
  })

  it('centers card and renders solid backdrop overlay when target element is not in DOM', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const dialog = screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })
    expect(dialog).toBeInTheDocument()
    // No target element -> no directional arrow
    expect(dialog.querySelector('.rotate-45')).toBeNull()

    // Solid backdrop rendered into document.body portal
    const backdrop = document.querySelector('.bg-black\\/70')
    expect(backdrop).toBeInTheDocument()
  })

  it('renders all 8 progress indicator dots with active indicator matching current step', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const activeDots = document.querySelectorAll('.w-4.bg-blue-600')
    expect(activeDots.length).toBe(1)
    const inactiveDots = document.querySelectorAll('.w-1\\.5.bg-zinc-200')
    expect(inactiveDots.length).toBe(7)
  })

  it('renders MockDataCard for debt on step 4 with progress bar, balance, and WhatsApp preview', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    // Advance 3 times to step 4
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    expect(screen.getByText('4 / 8')).toBeInTheDocument()
    expect(screen.getByText('معاينة: دين مسجل (سلفة أحمد)')).toBeInTheDocument()
    expect(screen.getByText(/الأصل: 50.000 د.أ • سُدّد: 30.000 د.أ/)).toBeInTheDocument()
    expect(screen.getByText('المتبقي: 20.000 د.أ')).toBeInTheDocument()
    expect(screen.getByText('مشاركة واتساب')).toBeInTheDocument()
  })

  it('renders MockDataCard for recurring on step 5 with recurrence details and due badge', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    expect(screen.getByText('5 / 8')).toBeInTheDocument()
    expect(screen.getByText('معاينة: التزام دوري مجدول')).toBeInTheDocument()
    expect(screen.getByText('اشتراك الإنترنت المنزلي')).toBeInTheDocument()
    expect(screen.getByText('-25.000 د.أ')).toBeInTheDocument()
    expect(screen.getByText('يستحق بعد 4 أيام')).toBeInTheDocument()
  })

  it('renders MockDataCard for money circle on step 6 with turn and payout info', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    expect(screen.getByText('6 / 8')).toBeInTheDocument()
    expect(screen.getByText('معاينة: صندوق جمعية عائلية')).toBeInTheDocument()
    expect(screen.getByText('دورك: الشهر رقم 3 من 10')).toBeInTheDocument()
    expect(screen.getByText('الاستلام: 1,000.000 د.أ')).toBeInTheDocument()
  })

  it('renders MockDataCard for report on step 7 with multi-segment distribution preview', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    expect(screen.getByText('7 / 8')).toBeInTheDocument()
    expect(screen.getByText('معاينة: تحليل توزيع المصاريف')).toBeInTheDocument()
    expect(screen.getByText('بقالة 45%')).toBeInTheDocument()
    expect(screen.getByText('فواتير 25%')).toBeInTheDocument()
    expect(screen.getByText('مطاعم 18%')).toBeInTheDocument()
    expect(screen.getByText('وفر +15% هذا الشهر')).toBeInTheDocument()
  })

  it('handles localStorage errors gracefully without throwing', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const onFinish = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={onFinish} />
      </MemoryRouter>
    )

    const skipBtn = screen.getByRole('button', { name: 'إغلاق الجولة' })
    fireEvent.click(skipBtn)

    expect(onFinish).toHaveBeenCalledTimes(1)
    setItemSpy.mockRestore()
  })

  it('toggles mobile swipe state when clicking row and closes via reset button', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: /الهاتف/ }))

    const row = screen.getByText('مشتريات بقالة وسوبرماركت').closest('.relative.z-10')!
    expect(row).toHaveStyle({ transform: 'none' })

    // Click row directly to toggle swipe open
    fireEvent.click(row)
    expect(row).toHaveStyle({ transform: 'translateX(165px)' })

    // Close via reset button
    const closeBtn = screen.getByRole('button', { name: 'إعادة إغلاق السحب' })
    fireEvent.click(closeBtn)
    expect(row).toHaveStyle({ transform: 'none' })
  })

  it('simulates edit and duplicate action feedback in mobile demo mode', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: /الهاتف/ }))
    fireEvent.click(screen.getByRole('button', { name: /جرّب السحب لليمين الآن/ }))

    // Edit action feedback
    fireEvent.click(screen.getByRole('button', { name: 'تعديل' }))
    expect(screen.getByText(/محاكاة: تم تجربة "تعديل المعاملة" بنجاح!/)).toBeInTheDocument()

    // Duplicate action feedback
    fireEvent.click(screen.getByRole('button', { name: 'تكرار' }))
    expect(screen.getByText(/محاكاة: تم تجربة "تكرار المعاملة" بنجاح!/)).toBeInTheDocument()
  })

  it('positions card docked to top (top: 12px) on mobile viewport when target is in lower half', () => {
    window.innerWidth = 375
    window.innerHeight = 667

    const targetEl = document.createElement('div')
    targetEl.setAttribute('data-tour', 'hero-balance')
    targetEl.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 450,
      left: 20,
      width: 300,
      height: 100,
      bottom: 550,
      right: 320,
    })
    document.body.appendChild(targetEl)

    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const dialog = screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })
    expect(dialog).toHaveStyle({ top: '12px', width: '351px' })

    document.body.removeChild(targetEl)
    window.innerWidth = 1280
    window.innerHeight = 800
  })

  it('responds to window resize event by updating layout without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    fireEvent(window, new Event('resize'))
    expect(screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })).toBeInTheDocument()
  })

  it('renders pointer-events-auto backdrop to prevent background clickthrough (BUG-01)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const backdrop = document.querySelector('.bg-black\\/70')
    expect(backdrop).toHaveClass('pointer-events-auto')
  })

  it('traps keyboard focus inside dialog and announces step via aria-live (BUG-19)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    const dialog = screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const liveAnnouncement = screen.getByText(/الخطوة 1 من 8: لوحة التحكم وحد الصرف اليومي/)
    expect(liveAnnouncement).toBeInTheDocument()

    // Tab key cycling
    const skipBtn = screen.getByRole('button', { name: 'إغلاق الجولة' })
    const nextBtn = screen.getByRole('button', { name: 'التالي' })
    nextBtn.focus()
    expect(document.activeElement).toBe(nextBtn)

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(skipBtn)
  })

  it('safely clamps step navigation to prevent array out of bounds (BUG-02)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SpotlightTour isOpen={true} onFinish={vi.fn()} />
      </MemoryRouter>
    )

    // Advance to step 8
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    expect(screen.getByText('8 / 8')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'فهمت، ابدأ الآن' })).toBeInTheDocument()
    // No next button to click, no out-of-bounds crash
    expect(screen.queryByRole('button', { name: 'التالي' })).toBeNull()
  })
})
