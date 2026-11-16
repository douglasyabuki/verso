"use client";

import {
  LogIn,
  LogOut,
  Settings,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AccountActions } from "@/hooks/account/use-account-actions";
import type { AccountSession } from "@/stores/account/session";

function initial(name: string) {
  return (
    Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        name.trim(),
      ),
    )[0]?.segment.toUpperCase() ?? ""
  );
}

/** Avatar menu for the utility rail: Settings plus sign-in or sign-out.
 * Sign in and Sign up both open Settings › Account, where provider buttons
 * start OAuth (the first sign-in creates the account).
 * @param props Session, shared account actions, and guarded navigation.
 * @returns The avatar trigger and its account menu.
 * @example <AccountMenu session={session} actions={actions} navigate={navigate} />
 */
export function AccountMenu({
  session,
  actions,
  navigate,
  side = "right",
}: {
  session?: AccountSession;
  actions: AccountActions;
  navigate: (destination: string) => void;
  side?: "right" | "top";
}) {
  const user =
    session?.kind === "authenticated" || session?.kind === "expired"
      ? session.user
      : null;
  const guest = session?.kind === "guest";
  const expired = session?.kind === "expired";
  const label = user ? user.name || user.email : "Guest";
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Account menu"
                  className="relative"
                />
              }
            />
          }
        >
          {user ? (
            <Avatar size="sm">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback className="bg-secondary font-medium text-secondary-foreground">
                {initial(label) || <UserRound aria-hidden="true" />}
              </AvatarFallback>
            </Avatar>
          ) : (
            // Guests get the plain rail icon so the trigger matches its siblings.
            <UserRound aria-hidden="true" />
          )}
          {expired && (
            <span
              aria-hidden="true"
              className="absolute end-0.5 top-0.5 size-2 rounded-full bg-destructive ring-2 ring-card"
            />
          )}
        </TooltipTrigger>
        <TooltipContent side={side}>
          {expired ? `${label} (sign-in expired)` : label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side={side} align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm text-foreground">{label}</span>
            <span className="truncate font-normal">
              {user
                ? expired
                  ? "Sign-in expired"
                  : user.email
                : "Saved in this browser"}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate("settings/account")}>
            <Settings aria-hidden="true" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {(guest || user) && <DropdownMenuSeparator />}
        {guest && (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate("settings/account")}>
              <LogIn aria-hidden="true" />
              Sign in
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("settings/account")}>
              <UserRoundPlus aria-hidden="true" />
              Sign up
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        {user && (
          <DropdownMenuGroup>
            {expired && (
              <DropdownMenuItem onClick={() => navigate("settings/account")}>
                <LogIn aria-hidden="true" />
                Sign in again
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={actions.busy}
              onClick={actions.requestSignOut}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
