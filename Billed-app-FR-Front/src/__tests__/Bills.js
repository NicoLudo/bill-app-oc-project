/**
 * @jest-environment jsdom
 */

import { screen, waitFor, fireEvent } from "@testing-library/dom";
import BillsUI from "../views/BillsUI.js";
import { bills } from "../fixtures/bills.js";
import Bills from "../containers/Bills.js";
import { ROUTES_PATH } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import router from "../app/Router.js";
import $ from 'jquery';

// Utility function to set up the test environment
const setupTestEnvironment = () => {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  window.localStorage.setItem('user', JSON.stringify({ type: 'Employee' }));
  const root = document.createElement("div");
  root.setAttribute("id", "root");
  document.body.append(root);
  router();
};

describe("Given I am connected as an employee", () => {
  beforeEach(setupTestEnvironment);

  describe("When I am on Bills Page", () => {

    test("Then bill icon in vertical layout should be highlighted", async () => {
      window.onNavigate(ROUTES_PATH.Bills);
      await waitFor(() => screen.getByTestId('icon-window'));
      const windowIcon = screen.getByTestId('icon-window');
      expect(windowIcon.classList.contains('active-icon')).toBeTruthy();
    });

    test("Then bills should be ordered from earliest to latest", () => {
      document.body.innerHTML = BillsUI({ data: bills });
      const dates = screen.getAllByText(/^\d{4}[- /.]\d{2}[- /.]\d{2}$/i).map(a => a.innerHTML);
      const antiChrono = (a, b) => ((a < b) ? 1 : -1);
      const datesSorted = [...dates].sort(antiChrono);
      expect(dates).toEqual(datesSorted);
    });

    test("Then clicking on the new bill button should navigate to the NewBill page", () => {
      window.onNavigate(ROUTES_PATH.Bills);
      const buttonNewBill = screen.getByTestId('btn-new-bill');
      fireEvent.click(buttonNewBill);
      expect(window.location.hash).toEqual(ROUTES_PATH.NewBill);
    });

    describe("When I click on the eye icon", () => {
      test("Then a modal should open with the bill image", () => {
        document.body.innerHTML = BillsUI({ data: bills });
        const billInstance = new Bills({ document, onNavigate, store: null, localStorage: window.localStorage });
        $.fn.modal = jest.fn();

        const eyeIcon = screen.getAllByTestId('icon-eye')[0];
        const handleClickIconEye = jest.spyOn(billInstance, 'handleClickIconEye');
        fireEvent.click(eyeIcon);

        expect(handleClickIconEye).toHaveBeenCalled();
        expect($.fn.modal).toHaveBeenCalledWith('show');
        expect(screen.getByAltText('Bill')).toBeTruthy();
      });
    });

    describe("When I get the bills", () => {
      test("Then it should fetch and format bills correctly", async () => {
        const billInstance = new Bills({ document, onNavigate, store: null, localStorage: window.localStorage });
        billInstance.store = {
          bills: () => ({
            list: () => Promise.resolve(bills)
          })
        };
        const getBills = jest.spyOn(billInstance, 'getBills');
        const formattedBills = await billInstance.getBills();

        expect(getBills).toHaveBeenCalled();
        expect(formattedBills.length).toBe(bills.length);

        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          const day = date.getDate();
          const month = date.toLocaleString('fr-FR', { month: 'long' });
          const year = date.getFullYear().toString().slice(-2);
          return `${day} ${month.slice(0, 3)}. ${year}`;
        };

        const expectedDates = bills.map(bill => formatDate(bill.date));

        formattedBills.forEach((bill, index) => {
          expect(bill.date.toLowerCase()).toBe(expectedDates[index].toLowerCase());
        });

        expect(formattedBills[0].status).toBe("En attente");
      });
    });
  });
});
