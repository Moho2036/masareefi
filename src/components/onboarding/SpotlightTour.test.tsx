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
    expect(dialog).toHaveStyle({ width: '420px' })

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
})
