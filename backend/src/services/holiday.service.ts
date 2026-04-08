import { prisma } from '../config/database';
import { AppError } from '../utils/app-error';

export class HolidayService {
  async list(organizationId: string, year?: number) {
    const where: any = { organization_id: organizationId };
    if (year) {
      where.date = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    return prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async create(organizationId: string, data: {
    name: string;
    date: string;
    is_recurring?: boolean;
  }) {
    const dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) {
      throw AppError.badRequest('Format tanggal tidak valid');
    }

    const existing = await prisma.holiday.findUnique({
      where: { organization_id_date: { organization_id: organizationId, date: dateObj } },
    });
    if (existing) throw AppError.conflict('Hari libur pada tanggal ini sudah ada');

    return prisma.holiday.create({
      data: {
        organization_id: organizationId,
        name: data.name,
        date: dateObj,
        is_recurring: data.is_recurring || false,
      },
    });
  }

  async update(organizationId: string, id: string, data: {
    name?: string;
    date?: string;
    is_recurring?: boolean;
  }) {
    const holiday = await prisma.holiday.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!holiday) throw AppError.notFound('Hari libur tidak ditemukan');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.is_recurring !== undefined) updateData.is_recurring = data.is_recurring;
    if (data.date) {
      const dateObj = new Date(data.date);
      if (isNaN(dateObj.getTime())) throw AppError.badRequest('Format tanggal tidak valid');
      updateData.date = dateObj;
    }

    return prisma.holiday.update({ where: { id }, data: updateData });
  }

  async delete(organizationId: string, id: string) {
    const holiday = await prisma.holiday.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!holiday) throw AppError.notFound('Hari libur tidak ditemukan');
    return prisma.holiday.delete({ where: { id } });
  }

  async isHoliday(organizationId: string, date: Date): Promise<boolean> {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const exact = await prisma.holiday.findUnique({
      where: { organization_id_date: { organization_id: organizationId, date: dateOnly } },
    });
    if (exact) return true;

    // Check recurring holidays (same month/day, any year)
    const recurring = await prisma.holiday.findFirst({
      where: {
        organization_id: organizationId,
        is_recurring: true,
        date: {
          // Match month and day by checking a date in any year
          gte: new Date(1970, dateOnly.getMonth(), dateOnly.getDate()),
          lt: new Date(1970, dateOnly.getMonth(), dateOnly.getDate() + 1),
        },
      },
    });

    return !!recurring;
  }
}

export const holidayService = new HolidayService();
