import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventType } from '@prisma/client';

@Injectable()
export class PermissionsService {
  // ----------------------------------------
  // ✦ GENERAL HELPERS ✦
  // ----------------------------------------
  isPremium(user): boolean {
    return !!user?.isPremium;
  }

  isViewer(member): boolean {
    return member.role === 'viewer';
  }

  isEditor(member): boolean {
    return member.role === 'editor';
  }

  isAdmin(member): boolean {
    return member.role === 'admin';
  }

  isOwner(member): boolean {
    return member.role === 'owner';
  }

  // ----------------------------------------
  // ✦ EVENT CREATION ✦
  // ----------------------------------------
  canCreateEvent(user, membership, dto) {
    if (!membership) {
      throw new ForbiddenException('You are not a member of this calendar');
    }

    // VIEWER → interdit
    if (this.isViewer(membership)) {
      throw new ForbiddenException('Viewers cannot create events');
    }

    // Sondage → Premium only
    if (dto.type === EventType.POLL && !this.isPremium(user)) {
      throw new ForbiddenException('Creating polls requires premium');
    }

    // Rappels multiples → Premium only
    if (dto.reminders && dto.reminders.length > 1 && !this.isPremium(user)) {
      throw new ForbiddenException('Multiple reminders require premium');
    }

    return true;
  }

  // ----------------------------------------
  // ✦ EVENT UPDATE ✦
  // ----------------------------------------
  canUpdateEvent(user, membership, event, dto) {
    if (!membership) {
      throw new ForbiddenException('You are not a member of this calendar');
    }

    // Viewer → interdit
    if (this.isViewer(membership)) {
      throw new ForbiddenException('Viewers cannot update events');
    }

    // Rappels multiples → Premium only
    if (dto?.reminders && dto.reminders.length > 1 && !this.isPremium(user)) {
      throw new ForbiddenException('Multiple reminders require premium');
    }

    // Modifier un sondage → Premium only
    if (event.type === EventType.POLL && !this.isPremium(user)) {
      throw new ForbiddenException('Editing polls requires premium');
    }

    return true;
  }

  // ----------------------------------------
  // ✦ EVENT DELETE ✦
  // ----------------------------------------
  canDeleteEvent(membership) {
    if (!membership) {
      throw new ForbiddenException('You are not a member of this calendar');
    }

    if (this.isViewer(membership)) {
      throw new ForbiddenException('Viewers cannot delete events');
    }

    if (this.isEditor(membership)) {
      throw new ForbiddenException('Editors cannot delete events');
    }

    // admin & owner → OK
    return true;
  }

  // ----------------------------------------
  // ✦ POLLS ✦
  // ----------------------------------------
  canCreatePoll(user, membership) {
    if (!membership) {
      throw new ForbiddenException('You are not a member of this calendar');
    }

    if (this.isViewer(membership)) {
      throw new ForbiddenException('Viewers cannot create polls');
    }

    if (!this.isPremium(user)) {
      throw new ForbiddenException('Premium required to create polls');
    }

    return true;
  }

  canFinalizePoll(user, membership) {
    if (!membership) {
      throw new ForbiddenException('You are not a member of this calendar');
    }

    if (!this.isAdmin(membership) && !this.isOwner(membership)) {
      throw new ForbiddenException('Only admin or owner can finalize polls');
    }

    if (!this.isPremium(user)) {
      throw new ForbiddenException('Premium required to finalize polls');
    }

    return true;
  }
  canPublishEvent(membership) {
    if (!membership) {
      throw new ForbiddenException('You are not a member of this calendar');
    }

    if (membership.role !== 'admin' && membership.role !== 'owner') {
      throw new ForbiddenException('Only admins or owners can publish events');
    }

    return true;
  }
  canVotePoll(membership) {
    if (!membership) throw new ForbiddenException('Not a member');
    if (membership.role === 'viewer')
      throw new ForbiddenException('Viewers cannot vote in polls');
    return true;
  }

  canComment(membership) {
    if (!membership) throw new ForbiddenException('Not a member');
    if (membership.role === 'viewer')
      throw new ForbiddenException('Viewers cannot comment');
    return true;
  }

  canRsvp(membership) {
    if (!membership) throw new ForbiddenException('Not a member');
    if (membership.role === 'viewer')
      throw new ForbiddenException('Viewers cannot RSVP');
    return true;
  }
}
