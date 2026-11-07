// Business tests mount the menu items inline; browser coverage exercises the real Reka portal.
export const menuStubs = {
        DropdownMenu: { template: '<div><slot /></div>' },
        DropdownMenuTrigger: { template: '<div><slot /></div>' },
        DropdownMenuContent: { template: '<div><slot /></div>' },
        DropdownMenuItem: { props: ['disabled'], emits: ['select'], template: `<button :disabled="disabled" @click="$emit('select', $event)"><slot/></button>` },
        DropdownMenuCheckboxItem: { emits: ['select'], template: `<button @click="$emit('select', $event)"><slot/></button>` },
        DropdownMenuSeparator: true, DropdownMenuLabel: { template: '<span><slot/></span>' },
}
