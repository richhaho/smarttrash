import { Component, OnInit, ViewEncapsulation, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { AppSettings } from '@app/app.settings';
import { Settings } from '@app/app.settings.model';
import { User } from '$/models/user.model';
import { SelectionModel } from '@angular/cdk/collections';
import { FormBuilder, FormGroup, EmailValidator } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { environment } from '@env/environment';
import { AuthenticationService } from '$/services/authentication.service';
import { BlockUIService } from '$/services/block-ui.service';
import { CommonService } from '$/services/common.service';
import * as moment from 'moment';
import * as _ from 'underscore';
import { AddWithdrawComponent } from '../add-withdraw/add-withdraw.component';
import { PasswordDialogComponent } from '$/components/password-dialog/password-dialog.component';

@Component({
	selector: 'app-list-withdraw',
	templateUrl: './list-withdraw.component.html',
	styleUrls: ['./list-withdraw.component.scss'],
	animations: [
		trigger('detailExpand', [
			state('collapsed', style({ height: '0px', minHeight: '0' })),
			state('expanded', style({ height: '*' })),
			transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
		]),
	],
})
export class ListWithdrawComponent implements OnInit {
	public displayedColumns: string[] = [
		'select',
		'index',
		'name',
		'cardId',
		'totalPoint',
		'withdrawPoint',
		'product',
		'productCount',
		'remainingPoint',
		'operator',
		'createdAt',
	];
	public displayedColumnsMobile: string[] = ['select', 'index', 'name', 'withdrawPoint', 'operator'];
	public dataSource: any;
	public selection = new SelectionModel<any>(true, []);
	public totalCnt: number;
	private pageSize = 10;
	public pageIndex: number;
	private search = '';
	private sortParam = {
		active: '',
		direction: '',
	};
	public searchForm: FormGroup;
	serverUrl = environment.apiUrl;
	public dialogOpened = false;

	public user: any;
	private userUpdatesSubscription: Subscription;

	public commonData: any;
	private commonDataUpdatesSubscription: Subscription;

	public cardId = '';
	public keyEventTime: Date = new Date();
	@HostListener('document:keypress', ['$event'])
	handleKeyboardEvent(event: KeyboardEvent) {
		if (!this.dialogOpened) {
			const time = new Date();
			if (time.getTime() - this.keyEventTime.getTime() > 200) {
				this.cardId = '' + event.key;
			} else {
				this.cardId += event.key;
			}
			this.keyEventTime = time;
			if (this.cardId.length === 10) {
				this.openAddDialog(this.cardId);
				this.cardId = '';
			}
		}
	}

	constructor(
		public router: Router,
		private fb: FormBuilder,
		private authenticationService: AuthenticationService,
		private blockUIService: BlockUIService,
		public commonService: CommonService,
		private snackBar: MatSnackBar,
		public dialog: MatDialog,
	) {}

	ngOnInit() {
		this.searchForm = this.fb.group({
			keyword: '',
		});

		this.userUpdatesSubscription = this.authenticationService.getUserUpdates().subscribe((user) => {
			this.user = user;
		});

		this.commonDataUpdatesSubscription = this.commonService.getCommonDataUpdates().subscribe((commonData) => {
			this.commonData = commonData;
		});
		this.getWithdraws();
	}

	public getWithdraws(event?): void {
		if (event) {
			this.pageSize = event.pageSize;
			this.pageIndex = event.pageIndex;
		}

		this.blockUIService.setBlockStatus(true);
		this.commonService
			.getWithdraws({
				limit: this.pageSize,
				offset: this.pageIndex,
				search: this.searchForm.value.keyword,
				active: this.sortParam.active,
				direction: this.sortParam.direction,
			})
			.subscribe(
				(res: any) => {
					this.blockUIService.setBlockStatus(false);
					if (res.data) {
						this.totalCnt = res.data.totalCnt;
						this.dataSource = new MatTableDataSource<any>(res.data.list);
						this.selection.clear();
						if (this.totalCnt <= this.pageSize * this.pageIndex) {
							this.pageIndex = 0;
						}
					} else {
						this.snackBar.open(res.msg, '??????', { duration: 1500 });
					}
				},
				(err: HttpErrorResponse) => {
					this.blockUIService.setBlockStatus(false);
					this.snackBar.open(err.error.msg, '??????', { duration: 4000 });
				},
			);
	}

	processData(users) {
		users.forEach((element) => {
			let totalPoint = 0;
			element.trashlogs.forEach((item) => {
				totalPoint += item.amount * (item.dust ? item.dust.point : 0);
			});
			element.totalPoint = totalPoint;
		});
		return users;
	}

	isAllSelected() {
		const numSelected = this.selection.selected.length;
		const numRows = this.dataSource.data.length;
		return numSelected === numRows;
	}

	masterToggle() {
		this.isAllSelected()
			? this.selection.clear()
			: this.dataSource.data.forEach((row) => this.selection.select(row));
	}

	public customSort(event) {
		this.sortParam = event;
		this.getWithdraws();
	}

	applySearch() {
		this.getWithdraws();
	}

	public openAddDialog(cardId) {
		this.dialogOpened = true;
		this.commonService.getUserByCard(cardId).subscribe(
			(res: any) => {
				if (res.data) {
					this.dialog
						.open(AddWithdrawComponent, {
							data: res.data,
							width: '600px',
						})
						.afterClosed()
						.subscribe((data) => {
							this.dialogOpened = false;
							if (data) {
								this.getWithdraws();
							}
						});
				} else {
					this.snackBar.open(res.msg, '??????', { duration: 1500 });
				}
			},
			(err: HttpErrorResponse) => {
				this.snackBar.open(err.error.msg, '??????', { duration: 4000 });
			},
		);
	}

	public getAllData(resolve) {
		this.blockUIService.setBlockStatus(true);
		this.commonService
			.getWithdraws({
				search: this.searchForm.value.keyword,
				active: this.sortParam.active,
				direction: this.sortParam.direction,
			})
			.subscribe(
				(res: any) => {
					this.blockUIService.setBlockStatus(false);
					if (res.data) {
						resolve(res.data.list);
					} else {
						this.snackBar.open(res.msg, '????????????', { duration: 1500 });
					}
				},
				(err: HttpErrorResponse) => {
					this.blockUIService.setBlockStatus(false);
					this.snackBar.open(err.error.msg, '????????????', { duration: 4000 });
				},
			);
	}

	public export(fileType) {
		this.dialog
			.open(PasswordDialogComponent, {
				data: null,
				width: '360px',
			})
			.afterClosed()
			.subscribe((res) => {
				if (res === 'ok') {
					const self = this;
					new Promise(function (resolve, reject) {
						self.getAllData(resolve);
					}).then(function (value: any) {
						const printData: any[] = [];
						value.forEach((element) => {
							printData.push({
								No: element.index + 1,
								??????: element.user.name,
								??????: element.cardId,
								???????????????: Math.round(element.totalPoint * 10) / 10,
								????????????: Math.round(element.withdrawPoint * 10) / 10,
								??????????????????: element.product?.name || '-',
								??????????????????: element.productCount || '-',
								??????????????????: Math.round((element.totalPoint - element.withdrawPoint) * 10) / 10,
								?????????: element.operator.name,
								????????????: element.createdAt
									? moment(element.createdAt).format('YYYY.MM.DD - HH:mm:ss')
									: '',
							});
						});
						self.commonService.exportAsExcelFile(printData, '????????????');
					});
				}
			});
	}

	public print() {
		this.dialog
			.open(PasswordDialogComponent, {
				data: null,
				width: '360px',
			})
			.afterClosed()
			.subscribe((res) => {
				if (res === 'ok') {
					const self = this;
					new Promise(function (resolve, reject) {
						self.getAllData(resolve);
					}).then(function (value: any) {
						const printData: any[] = [];
						value.forEach((element) => {
							printData.push({
								index: element.index + 1,
								name: element.user.name,
								cardId: element.cardId,
								totalPoint: Math.round(element.totalPoint * 10) / 10,
								withdrawPoint: Math.round(element.withdrawPoint * 10) / 10,
								productName: element.product?.name || '-',
								productCount: element.productCount || '-',
								restPoint: Math.round((element.totalPoint - element.withdrawPoint) * 10) / 10,
								operator: element.operator.name,
								createdAt: element.createdAt
									? moment(element.createdAt).format('YYYY.MM.DD - HH:mm:ss')
									: '',
							});
						});
						self.commonService.printTable({
							columns: [
								'index',
								'name',
								'cardId',
								'totalPoint',
								'withdrawPoint',
								'productName',
								'productCount',
								'restPoint',
								'operator',
								'createdAt',
							],
							headers: [
								'No',
								'??????',
								'??????',
								'???????????????',
								'????????????',
								'??????????????????',
								'??????????????????',
								'??????????????????',
								'?????????',
								'????????????',
							],
							content: printData,
						});
					});
				}
			});
	}
}
