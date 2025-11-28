#ifndef MOVIE_H_
#define MOVIE_H_

using namespace std;

#include "Eval.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <map>
#include <cassert>
#include <iomanip>

class Movie {
private:
    map<int, string> movie_id_to_title;
    // map<int, double> movie_id_to_pr;
    // map<int, double> movie_id_to_dc;
    int movie_count;
    vector<pair<int, double>> ordered_dc;
    map<int, int> movie_id_to_dc_ranking;

public:
    Movie();
    string get_movie_id_to_title(int movie_id) const;
    // double get_movie_id_to_pr(int movie_id);
    void print_ranking(map<int, double>& ppr, int k) const;
    void print_ranking(unordered_map<int, double>& ppr, int k) const;
    bool is_movie(int node_id) const {
        if (node_id < movie_count) return true;
        else return false;
    }
    void set_ordered_dc(vector<pair<int, double>> input_ordered_dc);
    // void print_increase_ranking(vector<pair<int, double>> ppr, int k);
    // vector<pair<int, double>> get_increase_movie_ranking(map<int, double> ppr, int k);
    // vector<int> get_all_movie_id_list() const;
};

#endif